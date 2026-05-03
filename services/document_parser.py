import csv
import io
import math
import os
import re
import tempfile
from collections import defaultdict
from typing import Any, Dict, List, Tuple

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
        confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0.62
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
        for row in rows[header_index + 1 :]:
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


def analyze_documents(files: List[Tuple[str, bytes]]) -> Dict[str, Any]:
    material_rows: List[Dict[str, Any]] = []
    drawing_takeoff = []
    logs = []
    project_hints: Dict[str, Any] = {"area": None, "floors": None, "location": None}

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
                logs.append({"file": filename, "type": "cad", "status": "parsed-dxf", "rows": len(takeoff.get("cad_entities", []))})
            elif ext == ".dwg":
                drawing_takeoff.append(
                    {
                        "file": filename,
                        "cad_entities": [],
                        "drawing_area_sqft": None,
                        "notes": ["DWG uploaded. Production setup should convert DWG to DXF/IFC using a CAD conversion worker before takeoff."],
                    }
                )
                logs.append({"file": filename, "type": "cad", "status": "conversion-required", "rows": 0})
            else:
                logs.append({"file": filename, "type": ext.replace(".", "") or "unknown", "status": "unsupported", "rows": 0})
        except Exception as exc:
            logs.append({"file": filename, "type": ext, "status": f"failed: {exc}", "rows": 0})

    grouped = defaultdict(float)
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

    return {
        "summary": {
            "files": len(files),
            "material_rows": len(material_rows),
            "drawing_files": len(drawing_takeoff),
            "mapped_value": round(sum(row["amount"] for row in material_rows)),
            "average_confidence": round(sum(row["confidence"] for row in material_rows) / len(material_rows), 2) if material_rows else 0,
        },
        "suggested_project": suggested_project,
        "material_rows": material_rows,
        "category_totals": [{"name": key, "value": round(value)} for key, value in grouped.items()],
        "drawing_takeoff": drawing_takeoff,
        "extraction_log": logs,
        "assumptions": assumptions,
    }

