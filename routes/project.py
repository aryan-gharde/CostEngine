import json
from datetime import datetime

from fastapi import APIRouter, Header, HTTPException

from models.schemas import ProjectCreate, ProjectUpdate
from services.cost_engine import calculate_estimate
from services.database import DATABASE_URL, Project, SessionToken, session_scope, to_dict_project

router = APIRouter(prefix="/project", tags=["project"])


def current_user_id(authorization: str | None):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    token = authorization.replace("Bearer ", "")
    with session_scope() as db:
        session = db.get(SessionToken, token)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid session")
        return session.user_id


@router.post("/create")
def create_project(payload: ProjectCreate, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    estimate = calculate_estimate(payload, payload.line_items, payload.risk_buffer)
    with session_scope() as db:
        project = Project(
            user_id=user_id,
            name=payload.name,
            location=payload.location,
            area=payload.area,
            floors=payload.floors,
            quality_tier=payload.quality_tier,
            finish_level=payload.finish_level,
            material_preferences=json.dumps(payload.material_preferences) if DATABASE_URL.startswith("sqlite") else payload.material_preferences,
            estimate=json.dumps(estimate) if DATABASE_URL.startswith("sqlite") else estimate,
        )
        db.add(project)
        db.flush()
        return to_dict_project(project)


@router.get("/list")
def list_projects(authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with session_scope() as db:
        projects = db.query(Project).filter(Project.user_id == user_id).order_by(Project.updated_at.desc()).all()
        return [to_dict_project(project) for project in projects]


@router.get("/{project_id}")
def get_project(project_id: int, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with session_scope() as db:
        project = db.get(Project, project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(status_code=404, detail="Project not found")
        return to_dict_project(project)


@router.patch("/{project_id}")
def update_project(project_id: int, payload: ProjectUpdate, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with session_scope() as db:
        project = db.get(Project, project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(status_code=404, detail="Project not found")
        for field, value in payload.model_dump(exclude_none=True).items():
            if field == "material_preferences" and DATABASE_URL.startswith("sqlite"):
                value = json.dumps(value)
            setattr(project, field, value)
        project.updated_at = datetime.utcnow()
        db.flush()
        return to_dict_project(project)


@router.delete("/{project_id}")
def delete_project(project_id: int, authorization: str | None = Header(default=None)):
    user_id = current_user_id(authorization)
    with session_scope() as db:
        project = db.get(Project, project_id)
        if not project or project.user_id != user_id:
            raise HTTPException(status_code=404, detail="Project not found")
        db.delete(project)
        return {"deleted": True, "project_id": project_id}
