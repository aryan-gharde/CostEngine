from fastapi import APIRouter

from models.schemas import AIExplainRequest
from services.ai_service import explain_estimate

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/explain")
def explain(payload: AIExplainRequest):
    return explain_estimate(payload.estimate, payload.question)

