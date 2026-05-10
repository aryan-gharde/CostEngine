from fastapi import APIRouter

from models.schemas import PriceUpdateRequest, TemplateUpdateRequest
from services.database import get_config, set_config

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/prices")
def get_prices():
    return get_config("material_prices")


@router.post("/prices")
def update_prices(payload: PriceUpdateRequest):
    return set_config("material_prices", payload.prices)


@router.get("/templates")
def get_templates():
    return get_config("templates")


@router.post("/templates")
def update_templates(payload: TemplateUpdateRequest):
    return set_config("templates", payload.templates)

