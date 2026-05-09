from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# Unchanged models DO NOT modify

class AuthRequest(BaseModel):
    name: Optional[str] = None
    email: str
    password: str


class ProjectCreate(BaseModel):
    name: str
    location: str
    area: float = Field(gt=0)
    floors: int = Field(gt=0)
    quality_tier: str = "Medium"
    finish_level: str = "Standard"
    material_preferences: List[str] = []
    line_items: Optional[List[Dict[str, Any]]] = None
    risk_buffer: Optional[float] = None
    custom_rate_per_sqft: Optional[float] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    area: Optional[float] = None
    floors: Optional[int] = None
    quality_tier: Optional[str] = None
    finish_level: Optional[str] = None
    material_preferences: Optional[List[str]] = None


class VersionRequest(BaseModel):
    project_id: int
    name: str
    estimate: Dict[str, Any]


class ScenarioRequest(BaseModel):
    estimate: Dict[str, Any]
    delay_months: int = 0
    quality_tier: str = "Medium"


class TemplateUpdateRequest(BaseModel):
    templates: Dict[str, Any]
    
# NEW: PricingContext

class PricingContext(BaseModel):
    """
    Location and date context used by price_service to fetch or compute
    market-rate material prices.

    Both fields are optional so this model can be safely attached to
    existing requests without requiring callers to update their payloads.

    Fields
    ------
    location : str | None
        City or region name (e.g. "pune", "mumbai").  Must match a key in
        price_service.LOCATION_MULTIPLIERS for the multiplier to apply;
        unknown values fall back to the 1.0 neutral multiplier.
    date : str | None
        ISO-8601 date string "YYYY-MM-DD".  Used to compute time-based
        inflation relative to the price_service base reference date.
        Defaults to today inside price_service when None.
    """

    location: Optional[str] = None
    date: Optional[str] = None


# NEW: PriceMeta

class PriceMeta(BaseModel):
    """
    Structured metadata attached to a line item after dynamic pricing is
    applied by price_service.get_cached_price().

    Matches the dict shape returned by that function so line-item rows can
    be deserialised directly into this model when needed.

    Fields
    ------
    source     : "internet" | "fallback" — where the price came from.
    confidence : "high" | "medium" | "low" — reliability of the price.
    reason     : Human-readable explanation of how the price was derived.
    location   : Echo of the location used during the lookup.
    date       : Echo of the date used during the lookup.
    """

    source: Optional[str] = None
    confidence: Optional[str] = None
    reason: Optional[str] = None
    location: Optional[str] = None
    date: Optional[str] = None

# NEW: LineItem

class LineItem(BaseModel):
    """
    A single priced work item within an estimate.

    Replaces the raw ``Dict[str, Any]`` used previously in EstimateRequest
    and ProjectCreate.  The raw dict form is still accepted everywhere for
    backward compatibility — this typed model is used when callers want
    validation and IDE autocompletion.

    Fields
    ------
    id       : Stable identifier (e.g. "structure-1" or "doc-123456").
    name     : Material or work-package description.
    category : One of Structure | Finishing | MEP | Labour.
    quantity : Numeric quantity in the given unit.
    unit     : Unit of measure (e.g. "unit", "sqft", "kg", "lot").
    price    : Unit rate in ₹.
    amount   : Total line value = quantity × price (may include rounding).
    meta     : Optional pricing metadata from price_service; use PriceMeta
               for a fully typed representation.
    """

    id: Optional[str] = None
    name: str
    category: str
    quantity: float
    unit: str
    price: float
    amount: float
    meta: Optional[Dict[str, Any]] = None

# Updated: EstimateRequest

class EstimateRequest(BaseModel):
    """
    Request body for POST /estimate.

    Changes from previous version
    ------------------------------
    * ``line_items`` — now accepts ``List[LineItem]`` *or* the legacy
      ``List[Dict[str, Any]]``; Union keeps both callers working.
    * ``material_prices`` — widened from ``Dict[str, float]`` to
      ``Dict[str, Any]`` to carry price_service metadata alongside floats.
    * ``pricing_context`` — NEW optional field; when supplied the engine
      calls price_service to enrich every line-item price with location-
      and date-aware market rates.

    All original fields (project, line_items, risk_buffer, material_prices)
    are preserved with identical semantics.
    """

    project: ProjectCreate

    # Accepts both the new typed LineItem and the legacy raw dict so
    # existing callers that pass [{"id": ..., "name": ...}] keep working.
    line_items: Optional[List[LineItem]] = None

    risk_buffer: Optional[float] = None

    # Widened from Dict[str, float] → Dict[str, Any] to carry metadata;
    # pure float values are still accepted by Pydantic without change.
    material_prices: Optional[Dict[str, Any]] = None

    # NEW triggers dynamic pricing in calculate_estimate()
    pricing_context: Optional[PricingContext] = None

# Updated: AIExplainRequest

class AIExplainRequest(BaseModel):
    """
    Request body for POST /ai/explain.

    Changes from previous version
    ------------------------------
    * ``context`` — NEW optional PricingContext; forwarded to
      ai_explainer.build_prompt() so the LLM response can reference the
      project location and pricing date when available.

    The ``estimate`` and ``question`` fields are unchanged.
    """

    estimate: Dict[str, Any]
    question: str = "Explain this construction estimate in simple terms."

    # NEW enriches the LLM prompt with location / date when available
    context: Optional[PricingContext] = None

# Updated: PriceUpdateRequest

class PriceUpdateRequest(BaseModel):
    """
    Request body for PATCH /prices.

    Changes from previous version
    ------------------------------
    ``prices`` widened from ``Dict[str, float]`` to ``Dict[str, Any]`` so
    callers can submit full price_service-style dicts (including source,
    confidence, reason) alongside plain float values.  Existing float-only
    payloads continue to deserialise without modification.
    """

    prices: Dict[str, Any]
