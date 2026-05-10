import json
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException

from models.schemas import EstimateRequest, VersionRequest
from routes.project import current_user_id
from services.cost_engine import calculate_estimate
from services.database import DATABASE_URL, EstimateVersion, Project, session_scope, to_dict_project, to_dict_version

router = APIRouter(prefix="/estimate", tags=["estimate"])


@router.post("/calculate")
def calculate(payload: EstimateRequest):
    return calculate_estimate(payload.project, payload.line_items, payload.risk_buffer, payload.material_prices)


@router.post("/project/{project_id}/recalculate")
def recalculate_project(project_id: int, payload: EstimateRequest, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    estimate = calculate_estimate(payload.project, payload.line_items, payload.risk_buffer, payload.material_prices)
    with session_scope() as db:
        project = db.get(Project, project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(status_code=404, detail="Project not found")
        project.estimate = json.dumps(estimate) if DATABASE_URL.startswith("sqlite") else estimate
        project.quality_tier = payload.project.quality_tier
        project.finish_level = payload.project.finish_level
        project.updated_at = datetime.utcnow()
        db.flush()
        return to_dict_project(project)


@router.post("/version")
def save_version(payload: VersionRequest, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with session_scope() as db:
        project = db.get(Project, payload.project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(status_code=404, detail="Project not found")
        version = EstimateVersion(
            project_id=payload.project_id,
            name=payload.name,
            estimate=json.dumps(payload.estimate) if DATABASE_URL.startswith("sqlite") else payload.estimate,
        )
        db.add(version)
        db.flush()
        return to_dict_version(version)


@router.get("/version/{project_id}")
def list_versions(project_id: int, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with session_scope() as db:
        project = db.get(Project, project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(status_code=404, detail="Project not found")
        versions = db.query(EstimateVersion).filter(EstimateVersion.project_id == project_id).order_by(EstimateVersion.created_at.desc()).all()
        return [to_dict_version(version) for version in versions]

