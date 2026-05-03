from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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


class EstimateRequest(BaseModel):
    project: ProjectCreate
    line_items: Optional[List[Dict[str, Any]]] = None
    risk_buffer: Optional[float] = None
    material_prices: Optional[Dict[str, float]] = None


class VersionRequest(BaseModel):
    project_id: int
    name: str
    estimate: Dict[str, Any]


class AIExplainRequest(BaseModel):
    estimate: Dict[str, Any]
    question: str = "Explain this construction estimate in simple terms."


class ScenarioRequest(BaseModel):
    estimate: Dict[str, Any]
    delay_months: int = 0
    quality_tier: str = "Medium"


class PriceUpdateRequest(BaseModel):
    prices: Dict[str, float]


class TemplateUpdateRequest(BaseModel):
    templates: Dict[str, Any]
