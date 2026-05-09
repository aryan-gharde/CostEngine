from __future__ import annotations

import re
import logging
from datetime import datetime, date as _date_type
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__
# In-memory cache  {(material, location, date): result_dict}
CACHE: dict[tuple[str, str, str], dict] = {}
# Base prices (₹ per unit) — used as fallback / anchor
BASE_PRICES: dict[str, float] = {
    # Structure
    "rcc frame": 850.0,
    "steel reinforcement": 72000.0,   # per tonne, ~₹72/kg
    "masonry": 420.0,
    "waterproofing": 180.0,
    # Finishing
    "flooring": 120.0,
    "paint and putty": 55.0,
    "doors and windows": 9500.0,
    "fixtures": 3200.0,
    # MEP
    "electrical": 220.0,
    "plumbing": 310.0,
    "fire and safety": 1800.0,
    "hvac provisions": 1400.0,
    # Labour
    "civil labour": 650.0,
    "skilled trades": 850.0,
    "site supervision": 45000.0,
}

# City-level cost-of-living multiplier (relative to Pune baseline = 1.0)
LOCATION_MULTIPLIERS: dict[str, float] = {
    "mumbai": 1.28,
    "delhi": 1.22,
    "bangalore": 1.18,
    "hyderabad": 1.12,
    "chennai": 1.10,
    "kolkata": 1.05,
    "pune": 1.00,
    "ahmedabad": 0.96,
    "jaipur": 0.92,
    "lucknow": 0.90,
    "indore": 0.88,
    "bhopal": 0.87,
    "nagpur": 0.95,
    "surat": 0.97,
    "coimbatore": 0.93,
}

# Annual inflation rate for construction materials (%)
ANNUAL_INFLATION_RATE: float = 6.0   # 6 % per year ≈ 0.5 % per month
BASE_REFERENCE_DATE: str = "2024-01-01"

# HTTP request settings
REQUEST_TIMEOUT: int = 8   # seconds
SEARCH_URL: str = "https://html.duckduckgo.com/html/"
USER_AGENT: str = (
    "Mozilla/5.0 (compatible; PriceBot/1.0; +https://example.com/pricebot)"
)
# Public entry points

def get_material_price(material: str, location: str, date: str) -> dict:
    """
    Master function.  Returns a price dict for *material* at *location*
    on *date*.

    Return shape
    ------------
    {
        "price":      float,
        "source":     "internet" | "fallback",
        "location":   str,
        "date":       str,
        "confidence": "high" | "medium" | "low",
        "reason":     str,
    }
    """
    material = material.strip().lower()
    location = location.strip().lower()
    date = _validate_date(date)

    # 1. Try the web
    raw_html = fetch_from_internet(material, location)
    if raw_html:
        result = normalize_price(raw_html, material, location, date)
        if result:
            return result

    # 2. Fall back to built-in table
    return fallback_price(material, location, date)


def get_cached_price(material: str, location: str, date: str) -> dict:
    """
    Cached wrapper around get_material_price.
    Subsequent calls with identical (material, location, date) are free.
    """
    key = (material.strip().lower(), location.strip().lower(), _validate_date(date))
    if key not in CACHE:
        CACHE[key] = get_material_price(*key)
    return CACHE[key]

# Sub-functions

def fetch_from_internet(material: str, location: str) -> Optional[str]:
    """
    Issue a DuckDuckGo HTML search for the current market price of *material*
    in *location*.  Returns raw HTML text on success, None on any failure.
    """
    query = f"{material} price per unit {location} India construction 2024"
    try:
        response = requests.post(
            SEARCH_URL,
            data={"q": query, "kl": "in-en"},
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        logger.debug("fetch_from_internet: got %d bytes for '%s'", len(response.text), material)
        return response.text
    except requests.exceptions.Timeout:
        logger.warning("fetch_from_internet: timeout for material='%s' location='%s'", material, location)
    except requests.exceptions.RequestException as exc:
        logger.warning("fetch_from_internet: request failed — %s", exc)
    return None


def normalize_price(raw_data: str, material: str, location: str, date: str) -> Optional[dict]:
    """
    Parse ₹ values from *raw_data* (HTML), compute average, and return a
    structured price dict.  Returns None if no usable prices are found.
    """
    try:
        soup = BeautifulSoup(raw_data, "html.parser")
        text = soup.get_text(separator=" ")
    except Exception as exc:
        logger.warning("normalize_price: HTML parse error — %s", exc)
        return None

    # Match patterns like ₹1,200 / Rs. 1200 / INR 1,200
    patterns = [
        r"(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)",   # ₹1,200.50
        r"([\d,]+(?:\.\d{1,2})?)\s*(?:per|/)\s*(?:sq\.?ft|sqft|unit|kg|ton|bag)",
    ]
    prices: list[float] = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            raw_val = match.group(1).replace(",", "")
            try:
                val = float(raw_val)
                # Sanity-check: ignore implausibly tiny or huge numbers
                if 1.0 <= val <= 10_000_000.0:
                    prices.append(val)
            except ValueError:
                pass

    if not prices:
        logger.debug("normalize_price: no ₹ values found for '%s'", material)
        return None

    # Use the trimmed mean of the central 80 % of values to reduce outlier impact
    prices.sort()
    trim = max(1, len(prices) // 10)
    trimmed = prices[trim: len(prices) - trim] if len(prices) > 4 else prices
    avg_price = round(sum(trimmed) / len(trimmed), 2)

    confidence = _confidence_from_sample_size(len(prices))
    return {
        "price": avg_price,
        "source": "internet",
        "location": location,
        "date": date,
        "confidence": confidence,
        "reason": f"Parsed {len(prices)} price point(s) from web search; trimmed mean used.",
    }


def fallback_price(material: str, location: str, date: str) -> dict:
    """
    Return a price estimate from BASE_PRICES, adjusted for location and
    time-based inflation.
    """
    material = material.strip().lower()
    location = location.strip().lower()

    # Look for the closest key match (substring search as fuzzy fallback)
    base = _lookup_base_price(material)

    loc_multiplier = LOCATION_MULTIPLIERS.get(location, 1.0)
    time_factor = get_time_factor(date)
    price = round(base * loc_multiplier * time_factor, 2)

    known_location = location in LOCATION_MULTIPLIERS
    confidence: str
    if known_location and base != _default_base():
        confidence = "medium"
        reason = (
            f"Fallback price: base ₹{base} × location {loc_multiplier} "
            f"× time {round(time_factor, 4)} = ₹{price}."
        )
    else:
        confidence = "low"
        reason = (
            f"Fallback price (generic estimate): base ₹{base} "
            f"× location {loc_multiplier} × time {round(time_factor, 4)} = ₹{price}. "
            + ("Location multiplier unavailable; defaulted to 1.0. " if not known_location else "")
        )

    return {
        "price": price,
        "source": "fallback",
        "location": location,
        "date": date,
        "confidence": confidence,
        "reason": reason,
    }


def get_time_factor(date: str) -> float:
    """
    Compute a simple compounding inflation multiplier between
    BASE_REFERENCE_DATE and *date*.

    Formula: (1 + monthly_rate) ^ months_elapsed
    """
    try:
        target = datetime.strptime(_validate_date(date), "%Y-%m-%d").date()
        reference = datetime.strptime(BASE_REFERENCE_DATE, "%Y-%m-%d").date()
    except ValueError:
        return 1.0

    months_elapsed = (target.year - reference.year) * 12 + (target.month - reference.month)
    monthly_rate = ANNUAL_INFLATION_RATE / 100.0 / 12.0
    factor = (1 + monthly_rate) ** months_elapsed
    return round(factor, 6)
    
# Internal helpers

def _validate_date(date: str) -> str:
    """Ensure date is YYYY-MM-DD; fall back to today on parse failure."""
    try:
        datetime.strptime(date, "%Y-%m-%d")
        return date
    except (ValueError, TypeError):
        today = _date_type.today().isoformat()
        logger.warning("_validate_date: invalid date '%s', defaulting to %s", date, today)
        return today


def _lookup_base_price(material: str) -> float:
    """
    Exact-key lookup first, then substring match, then generic default.
    """
    if material in BASE_PRICES:
        return BASE_PRICES[material]
    for key, val in BASE_PRICES.items():
        if key in material or material in key:
            return val
    return _default_base()


def _default_base() -> float:
    """Generic fallback when the material is completely unknown."""
    return 500.0


def _confidence_from_sample_size(n: int) -> str:
    if n >= 5:
        return "high"
    if n >= 2:
        return "medium"
    return "low"
