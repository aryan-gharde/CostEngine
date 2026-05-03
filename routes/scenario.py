from fastapi import APIRouter

from models.schemas import ScenarioRequest
from services.cost_engine import run_scenario

router = APIRouter(prefix="/scenario", tags=["scenario"])


@router.post("/run")
def run(payload: ScenarioRequest):
    return run_scenario(payload.estimate, payload.delay_months, payload.quality_tier)

