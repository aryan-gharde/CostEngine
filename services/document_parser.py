from __future__ import annotations

import csv
import io
import math
import os
import re
import tempfile
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

try:
    import ezdxf
except Exception:  # pragma: no cover - optional parser
    ezdxf = None

try:
    import openpyxl
except Exception:  # pragma: no cover - optional parser
    openpyxl = None

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - optional parser
    PdfReader = None
# Constants 

HEADER_SYNONYMS = {
    "material": ["material", "item", "description", "particular", "name", "boq item", "resource"],
    "category": ["category", "trade", "section", "work head", "package"],
    "quantity": ["qty", "quantity", "qnty", "nos", "volume", "area"],
    "unit": ["unit", "uom", "units"],
    "price": ["rate", "price", "unit rate", "basic rate", "cost"],
    "amount": ["amount", "total", "value", "extended cost"],
}

CATEGORY_HINTS = {
    "Structure": ["rcc", "steel", "rebar", "concrete", "masonry", "brick", "block", "waterproof"],
    "Finishing": ["tile", "paint", "putty", "door", "window", "floor", "fixture", "granite", "marble"],
    "MEP": ["electrical", "wire", "cable", "plumbing", "pipe", "hvac", "fire", "pump", "sanitary"],
    "Labour": ["labour", "labor", "supervision", "mason", "carpenter", "helper", "installation"],
}
# NEW: Material normalisation map
# Each entry: (canonical_name, [variant_substrings...])
# Listed most-specific first to avoid short-string false matches.
_MATERIAL_NORMALISATION_MAP: List[Tuple[str, List[str]]] = [
    # Structure
    # Longer / more-specific variants are listed first within each entry so
    # that "reinforced concrete" beats the bare "concrete" token, and
    # "rcc work" beats bare "rcc".
    ("RCC frame",           [
        "reinforced concrete", "concrete frame", "rcc work", "rcc slab",
        "rcc column", "rcc beam", "pcc", "rcc", "concrete",
    ]),
    ("Steel reinforcement", [
        "steel reinforcement", "reinforcement bar", "tmt bar", "re bar",
        "ms rod", "rebar", "steel", "tmt",
    ]),
    ("Masonry",             ["brickwork", "brickmasonry", "masonry", "brick", "block"]),
    ("Waterproofing",       ["waterproof", "damp proof", "dampproof", "bitumen coat"]),
    # Finishing
    ("Flooring",            ["floor tile", "vitrified tile", "mosaic tile", "flooring", "tiles", "tile"]),
    ("Paint and putty",     ["paint and putty", "primer coat", "distemper", "whitewash", "coating", "putty", "paint"]),
    ("Doors and windows",   ["door frame", "window frame", "door shutter", "glazing", "architrave", "window", "door"]),
    ("Fixtures",            ["hardware fitting", "ms grill", "handrail", "railing", "fixture", "fitting", "grill"]),
    # MEP
    ("Electrical",          ["electrical wiring", "mcb board", "conduit pipe", "switchboard", "wiring", "conduit", "cable", "wire", "electrical"]),
    ("Plumbing",            ["cpvc pipe", "upvc pipe", "pvc pipe", "sanitary fitting", "plumbing", "pipe", "sanitary"]),
    ("Fire and safety",     ["fire sprinkler", "smoke detector", "fire hydrant", "extinguisher", "sprinkler", "fire"]),
    ("HVAC provisions",     ["hvac duct", "exhaust fan", "air conditioning", "ventilation", "aircon", "hvac", "duct", "exhaust"]),
    # Labour
    ("Site supervision",    ["site engineer", "site supervisor", "project manager", "foreman", "supervision", "supervisor"]),
    ("Skilled trades",      ["skilled labour", "carpenter", "plumber", "electrician", "welder", "fabricator", "skilled"]),
    ("Civil labour",        ["civil labour", "civil labor", "unskilled labour", "unskilled", "mason", "helper", "coolies"]),
]

# Existing private helpers (unchanged)

def _clean(value: Any) -> str:
    return str(value or "").strip()


def _to_number(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = re.sub(r"[^\d.\-]", "", str(value))
    try:
        return float(text) if text else 0.0
    except ValueError:
        return 0.0


def _best_header(header: str) -> Tuple[str | None, float]:
    normalized = header.lower().strip()
    for target, variants in HEADER_SYNONYMS.items():
        if normalized in variants:
            return target, 0.98
        if any(variant in normalized for variant in variants):
            return target, 0.84
    return None, 0.0


def _infer_category(material: str, fallback: str = "") -> str:
    text = f"{material} {fallback}".lower()
    for category, hints in CATEGORY_HINTS.items():
        if any(hint in text for hint in hints):
            return category
    return fallback if fallback in CATEGORY_HINTS else "Structure"


def _normalize_rows(rows: List[Dict[str, Any]], source: str) -> List[Dict[str, Any]]:
    normalized_rows = []
    for index, raw in enumerate(rows, start=1):
        mapped = {}
        confidences = []
        for key, value in raw.items():
            target, confidence = _best_header(str(key))
            if target:
                mapped[target] = value
                confidences.append(confidence)
        material = _clean(mapped.get("material"))
        if not material:
            material = _clean(next((value for value in raw.values() if _clean(value)), f"Imported item {index}"))
        quantity = _to_number(mapped.get("quantity")) or 1
        price = _to_number(mapped.get("price"))
        amount = _to_number(mapped.get("amount")) or round(quantity * price)
        if not price and quantity:
            price = round(amount / quantity, 2) if amount else 0
        category = _infer_category(material, _clean(mapped.get("category")))

        # BONUS: small confidence boost when price and quantity are both positive
        base_confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0.62
        quality_boost = 0.0
        if price > 0:
            quality_boost += 0.03
        if quantity > 0:
            quality_boost += 0.02
        confidence = round(min(base_confidence + quality_boost, 1.0), 2)

        normalized_rows.append(
            {
                "id": f"doc-{abs(hash((source, index, material))) % 1000000}",
                "name": material,
                "category": category,
                "quantity": round(quantity, 2),
                "unit": _clean(mapped.get("unit")) or "unit",
                "price": round(price, 2),
                "amount": round(amount or quantity * price),
                "source": source,
                "confidence": confidence,
                "raw": raw,
            }
        )
    return normalized_rows


def _parse_csv(content: bytes, filename: str) -> List[Dict[str, Any]]:
    text = content.decode("utf-8-sig", errors="ignore")
    sample = text[:2048]
    dialect = csv.Sniffer().sniff(sample) if sample.strip() else csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    return _normalize_rows(list(reader), filename)


def _parse_xlsx(content: bytes, filename: str) -> List[Dict[str, Any]]:
    if not openpyxl:
        return []
    workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    extracted = []
    for sheet in workbook.worksheets:
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            continue
        header_index = 0
        for idx, row in enumerate(rows[:10]):
            mapped_count = sum(1 for cell in row if _best_header(_clean(cell))[0])
            if mapped_count >= 2:
                header_index = idx
                break
        headers = [_clean(cell) or f"Column {idx + 1}" for idx, cell in enumerate(rows[header_index])]
        dict_rows = []
        for row in rows[header_index + 1:]:
            if not any(_clean(cell) for cell in row):
                continue
            dict_rows.append({headers[idx]: row[idx] if idx < len(row) else None for idx in range(len(headers))})
        extracted.extend(_normalize_rows(dict_rows, f"{filename}:{sheet.title}"))
    return extracted


def _parse_pdf_text(content: bytes) -> Tuple[str, bool]:
    if not PdfReader:
        return "", True
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    text = "\n".join(pages)
    return text, len(text.strip()) < 40


def _rows_from_text(text: str, filename: str) -> List[Dict[str, Any]]:
    rows = []
    pattern = re.compile(
        r"(?P<name>[A-Za-z][A-Za-z0-9 /&().-]{3,}?)\s+(?P<qty>\d+(?:\.\d+)?)\s*(?P<unit>sqft|sft|sqm|cum|cft|kg|mt|bag|nos|unit)?\s+(?P<rate>\d{2,}(?:\.\d+)?)",
        re.IGNORECASE,
    )
    for match in pattern.finditer(text):
        qty = _to_number(match.group("qty"))
        rate = _to_number(match.group("rate"))
        name = _clean(match.group("name"))
        rows.append(
            {
                "Material": name,
                "Quantity": qty,
                "Unit": match.group("unit") or "unit",
                "Rate": rate,
                "Amount": round(qty * rate),
            }
        )
    return _normalize_rows(rows[:80], filename)


def _project_hints_from_text(text: str) -> Dict[str, Any]:
    area_match = re.search(r"(\d[\d,]*(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|sft)", text, re.IGNORECASE)
    floor_match = re.search(r"(\d+)\s*(?:floors?|storeys?|levels?)", text, re.IGNORECASE)
    location_match = re.search(r"(?:location|site)\s*[:\-]\s*([A-Za-z ,.-]{3,60})", text, re.IGNORECASE)
    return {
        "area": _to_number(area_match.group(1)) if area_match else None,
        "floors": int(floor_match.group(1)) if floor_match else None,
        "location": _clean(location_match.group(1)) if location_match else None,
    }


def _parse_dxf(content: bytes, filename: str) -> Dict[str, Any]:
    if not ezdxf:
        return {"cad_entities": [], "drawing_area_sqft": None, "notes": ["DXF parser dependency is unavailable."]}
    with tempfile.NamedTemporaryFile(delete=False, suffix=".dxf") as temp:
        temp.write(content)
        temp_path = temp.name
    try:
        doc = ezdxf.readfile(temp_path)
        modelspace = doc.modelspace()
        entity_counts = defaultdict(int)
        total_line_length = 0.0
        closed_polyline_area = 0.0
        for entity in modelspace:
            entity_type = entity.dxftype()
            entity_counts[entity_type] += 1
            if entity_type == "LINE":
                start = entity.dxf.start
                end = entity.dxf.end
                total_line_length += math.dist((start.x, start.y), (end.x, end.y))
            if entity_type == "LWPOLYLINE" and entity.closed:
                points = [(point[0], point[1]) for point in entity.get_points()]
                area = 0.0
                for idx, point in enumerate(points):
                    next_point = points[(idx + 1) % len(points)]
                    area += point[0] * next_point[1] - next_point[0] * point[1]
                closed_polyline_area += abs(area) / 2
        sqft_area = round(closed_polyline_area, 2) if closed_polyline_area else None
        return {
            "cad_entities": [{"type": key, "count": value} for key, value in sorted(entity_counts.items())],
            "drawing_area_sqft": sqft_area,
            "total_line_length": round(total_line_length, 2),
            "notes": [f"DXF parsed from {filename}. Confirm drawing unit scale before using quantities."],
        }
    finally:
        try:
            os.remove(temp_path)
        except OSError:
            pass

# NEW: Material name normalisation

def normalize_material_name(name: str) -> str:
    """
    Map a raw material description to its canonical CostEngine trade name.

    Strategy
    --------
    1. Lowercase + strip the input.
    2. Walk _MATERIAL_NORMALISATION_MAP in declaration order (most-specific
       variants are listed first within each entry to avoid short-token
       false matches, e.g. "rcc work" is checked before bare "rcc").
    3. Return the first canonical name whose variant appears as a substring
       in the normalised input.
    4. If nothing matches, return the original name unchanged — unknown
       materials are preserved so downstream code always has a value.

    Parameters
    ----------
    name : str
        Raw material text from an imported document.

    Returns
    -------
    str
        Canonical CostEngine name (e.g. "Steel reinforcement") or the
        original string if no mapping exists.

    Examples
    --------
    >>> normalize_material_name("TMT Steel bars 12mm dia")
    'Steel reinforcement'
    >>> normalize_material_name("Vitrified floor tiles 600x600")
    'Flooring'
    >>> normalize_material_name("Skylight polycarbonate panel")
    'Skylight polycarbonate panel'
    """
    if not name or not name.strip():
        return name

    lowered = name.lower().strip()

    for canonical, variants in _MATERIAL_NORMALISATION_MAP:
        for variant in variants:
            if variant in lowered:
                return canonical

    return name  # pass-through: keeps unknown materials intact

# NEW: Line-item conversion

def convert_to_line_items(material_rows: List[dict]) -> List[dict]:
    """
    Convert _normalize_rows output into the dict shape consumed by
    CostEngine's calculate_estimate(line_items=…).

    Each output row
    ---------------
    {
        "id":       str,
        "name":     str    normalised canonical name,
        "category": str,
        "quantity": float,
        "unit":     str,
        "price":    float,
        "amount":   int,
        "meta": {
            "source":     str | None,
            "confidence": float | None,
        }
    }

    Robustness
    ----------
    * Returns [] for None or empty input.
    * Silently skips individual malformed rows rather than raising.
    * Uses .get() everywhere — no KeyError on partial rows.
    """
    if not material_rows:
        return []

    line_items: List[dict] = []
    for row in material_rows:
        try:
            normalised_name = normalize_material_name(row.get("name", ""))
            line_items.append(
                {
                    "id":       row["id"],
                    "name":     normalised_name,
                    "category": row.get("category", "Structure"),
                    "quantity": row.get("quantity", 1),
                    "unit":     row.get("unit", "unit"),
                    "price":    row.get("price", 0.0),
                    "amount":   row.get("amount", 0),
                    "meta": {
                        "source":     row.get("source"),
                        "confidence": row.get("confidence"),
                    },
                }
            )
        except Exception:
            # Skip one bad row; never crash the whole conversion
            continue

    return line_items
# NEW: Date extraction from free text

# Abbreviated and full month name to zero-padded numeric string
_MONTH_NAMES: Dict[str, str] = {
    "january": "01",  "february": "02", "march":     "03", "april":    "04",
    "may":     "05",  "june":     "06", "july":      "07", "august":   "08",
    "september":"09", "october":  "10", "november":  "11", "december": "12",
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "jun": "06", "jul": "07", "aug": "08", "sep": "09",
    "oct": "10", "nov": "11", "dec": "12",
}

# Ordered most-specific → least-specific so earlier patterns win
_DATE_PATTERNS: List[Tuple[re.Pattern, str]] = [
    # 2026-05-09  or  2026/05/09
    (re.compile(r"\b(\d{4})[-/](\d{2})[-/](\d{2})\b"), "iso_full"),
    # 9 May 2026  /  09-May-2026
    (re.compile(r"\b(\d{1,2})[\s\-/]([A-Za-z]{3,9})[\s\-/](\d{4})\b"), "dmy_named"),
    # May 2026  /  May, 2026
    (re.compile(r"\b([A-Za-z]{3,9})[,\s]+(\d{4})\b"), "my_named"),
    # 05/2026  or  05-2026
    (re.compile(r"\b(\d{2})[-/](\d{4})\b"), "my_numeric"),
]


def extract_date_from_text(text: str) -> Optional[str]:
    """
    Return the first plausible date found in *text* as "YYYY-MM-DD".
    Day defaults to "01" when only month + year are present.

    Supported patterns
    ------------------
    * ISO full :  2026-05-09  /  2026/05/09       → "2026-05-09"
    * Day-Month-Year: 9 May 2026 / 09-May-2026    → "2026-05-09"
    * Month-Year (named): May 2026 / May, 2026    → "2026-05-01"
    * Month-Year (numeric): 05/2026 / 05-2026     → "2026-05-01"

    Returns None if no date is found or the extracted year falls outside
    the plausible construction-project window 2000–2099.
    """
    if not text:
        return None

    for pattern, kind in _DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        try:
            year: str
            month: str
            day: str

            if kind == "iso_full":
                year, month, day = match.group(1), match.group(2), match.group(3)

            elif kind == "dmy_named":
                day   = match.group(1).zfill(2)
                month = _MONTH_NAMES.get(match.group(2).lower(), "")
                year  = match.group(3)
                if not month:
                    continue

            elif kind == "my_named":
                month = _MONTH_NAMES.get(match.group(1).lower(), "")
                year  = match.group(2)
                day   = "01"
                if not month:
                    continue

            elif kind == "my_numeric":
                month, year = match.group(1), match.group(2)
                day = "01"

            else:
                continue

            year_int = int(year)
            if not (2000 <= year_int <= 2099):
                continue

            # Let datetime validate the assembled components (e.g. month=13 to ValueError)
            datetime(year_int, int(month), int(day))
            return f"{year}-{month}-{day}"

        except (ValueError, TypeError):
            continue  # malformed match try the next pattern

    return None
# Existing public function EXTENDED (no existing keys removed)

def analyze_documents(files: List[Tuple[str, bytes]]) -> Dict[str, Any]:
    """
    Analyse a list of (filename, bytes) tuples and return a unified
    extraction result suitable for direct consumption by CostEngine.

    Existing output keys (unchanged)
    ---------------------------------
    summary, suggested_project, material_rows, category_totals,
    drawing_takeoff, extraction_log, assumptions

    New output keys
    ---------------
    line_items      — CostEngine-ready rows produced by convert_to_line_items()
    pricing_context — {location, date, source} ready for price_service integration
    """
    material_rows: List[Dict[str, Any]] = []
    drawing_takeoff: List[Dict[str, Any]] = []
    logs: List[Dict[str, Any]] = []
    project_hints: Dict[str, Any] = {"area": None, "floors": None, "location": None}

    # NEW: accumulate all PDF text for a single cross document date search
    pdf_text_accumulator: List[str] = []

    for filename, content in files:
        ext = os.path.splitext(filename.lower())[1]
        try:
            if ext == ".csv":
                rows = _parse_csv(content, filename)
                material_rows.extend(rows)
                logs.append({"file": filename, "type": "csv", "status": "parsed", "rows": len(rows)})

            elif ext in {".xlsx", ".xlsm"}:
                rows = _parse_xlsx(content, filename)
                material_rows.extend(rows)
                logs.append({"file": filename, "type": "spreadsheet", "status": "parsed", "rows": len(rows)})

            elif ext == ".pdf":
                text, needs_ocr = _parse_pdf_text(content)
                pdf_text_accumulator.append(text)           # stash for date extraction
                material_rows.extend(_rows_from_text(text, filename))
                hints = _project_hints_from_text(text)
                project_hints = {key: project_hints.get(key) or value for key, value in hints.items()}
                logs.append(
                    {
                        "file": filename,
                        "type": "pdf",
                        "status": "ocr-required" if needs_ocr else "text-extracted",
                        "rows": len(_rows_from_text(text, filename)),
                    }
                )

            elif ext == ".dxf":
                takeoff = _parse_dxf(content, filename)
                drawing_takeoff.append({"file": filename, **takeoff})
                if takeoff.get("drawing_area_sqft"):
                    project_hints["area"] = project_hints.get("area") or takeoff["drawing_area_sqft"]
                logs.append({
                    "file": filename,
                    "type": "cad",
                    "status": "parsed-dxf",
                    "rows": len(takeoff.get("cad_entities", [])),
                })

            elif ext == ".dwg":
                drawing_takeoff.append(
                    {
                        "file": filename,
                        "cad_entities": [],
                        "drawing_area_sqft": None,
                        "notes": [
                            "DWG uploaded. Production setup should convert DWG to DXF/IFC "
                            "using a CAD conversion worker before takeoff."
                        ],
                    }
                )
                logs.append({"file": filename, "type": "cad", "status": "conversion-required", "rows": 0})

            else:
                logs.append({
                    "file": filename,
                    "type": ext.replace(".", "") or "unknown",
                    "status": "unsupported",
                    "rows": 0,
                })

        except Exception as exc:
            logs.append({"file": filename, "type": ext, "status": f"failed: {exc}", "rows": 0})

    # Existing aggregation (unchanged) 
    grouped: Dict[str, float] = defaultdict(float)
    for row in material_rows:
        grouped[row["category"]] += row["amount"]

    suggested_project = {
        "name": "Imported Design Estimate",
        "location": project_hints.get("location") or "Imported site",
        "area": project_hints.get("area") or 2500,
        "floors": project_hints.get("floors") or 2,
        "quality_tier": "Medium",
        "finish_level": "Standard",
        "material_preferences": sorted({row["name"] for row in material_rows[:8]}),
    }

    assumptions = [
        "AI mapping uses header synonyms, row semantics, and trade keyword classification.",
        "DXF quantities require drawing unit verification before commercial use.",
        "Scanned PDFs require an OCR worker such as Tesseract, Textract, Azure Form Recognizer, or Google Document AI.",
        "DWG requires conversion to DXF/IFC before reliable quantity extraction.",
    ]

    # ── NEW: build CostEngine line_items ──────────────────────────────────
    line_items = convert_to_line_items(material_rows)

    # ── NEW: extract project date from all accumulated PDF text ───────────
    combined_pdf_text = "\n".join(pdf_text_accumulator)
    extracted_date: Optional[str] = extract_date_from_text(combined_pdf_text)

    # ── NEW: pricing_context for price_service integration ────────────────
    pricing_context: Dict[str, Any] = {
        "location": project_hints.get("location"),   # None when unavailable
        "date":     extracted_date,                  # None when unavailable
        "source":   "document" if extracted_date else "inferred",
    }

    # ── Return dict: all original keys preserved + new keys appended ──────
    return {
        # ── original keys (unchanged) ──
        "summary": {
            "files": len(files),
            "material_rows": len(material_rows),
            "drawing_files": len(drawing_takeoff),
            "mapped_value": round(sum(row["amount"] for row in material_rows)),
            "average_confidence": (
                round(sum(row["confidence"] for row in material_rows) / len(material_rows), 2)
                if material_rows else 0
            ),
        },
        "suggested_project":  suggested_project,
        "material_rows":      material_rows,
        "category_totals":    [{"name": key, "value": round(value)} for key, value in grouped.items()],
        "drawing_takeoff":    drawing_takeoff,
        "extraction_log":     logs,
        "assumptions":        assumptions,
        # ── new keys ──
        "line_items":         line_items,
        "pricing_context":    pricing_context,
    }
