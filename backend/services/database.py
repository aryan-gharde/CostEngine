import json
import os
import hashlib
from contextlib import contextmanager
from datetime import datetime

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Float,
    Integer,
    MetaData,
    String,
    Text,
    create_engine,
    select,
)
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./construction_cost_demo.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base(metadata=MetaData())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(180), unique=True, index=True, nullable=False)
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SessionToken(Base):
    __tablename__ = "sessions"

    token = Column(String(80), primary_key=True)
    user_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(180), nullable=False)
    location = Column(String(180), nullable=False)
    area = Column(Float, nullable=False)
    floors = Column(Integer, nullable=False)
    quality_tier = Column(String(40), default="Medium")
    finish_level = Column(String(80), default="Standard")
    material_preferences = Column(JSON().with_variant(Text, "sqlite"), default=list)
    estimate = Column(JSON().with_variant(Text, "sqlite"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class EstimateVersion(Base):
    __tablename__ = "estimate_versions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, nullable=False, index=True)
    name = Column(String(160), nullable=False)
    estimate = Column(JSON().with_variant(Text, "sqlite"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ConfigEntry(Base):
    __tablename__ = "config_entries"

    key = Column(String(100), primary_key=True)
    value = Column(JSON().with_variant(Text, "sqlite"), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow)


def _serialize_json_columns(instance):
    if DATABASE_URL.startswith("sqlite"):
        for field in ("material_preferences", "estimate", "value"):
            value = getattr(instance, field, None)
            if isinstance(value, (dict, list)):
                setattr(instance, field, json.dumps(value))


def _deserialize(value):
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def init_db():
    Base.metadata.create_all(bind=engine)
    with session_scope() as db:
        demo = db.query(User).filter(User.email == "demo@siteiq.in").first()
        if not demo:
            db.add(
                User(
                    name="Aarav Mehta",
                    email="demo@siteiq.in",
                    password_hash=hashlib.sha256("demo12345".encode("utf-8")).hexdigest(),
                )
            )
        defaults = {
            "material_prices": {
                "steel": 62500,
                "cement": 410,
                "sand": 72,
                "aggregate": 96,
                "copper": 820,
            },
            "templates": {
                "residential": "RCC frame, brick infill, standard MEP, modular kitchen allowance",
                "premium": "RCC frame, premium tiles, concealed HVAC-ready MEP, acoustic glazing",
            },
        }
        for key, value in defaults.items():
            existing = db.get(ConfigEntry, key)
            if not existing:
                row = ConfigEntry(key=key, value=json.dumps(value) if DATABASE_URL.startswith("sqlite") else value)
                db.add(row)


@contextmanager
def session_scope():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def to_dict_project(project: Project):
    return {
        "id": project.id,
        "user_id": project.user_id,
        "name": project.name,
        "location": project.location,
        "area": project.area,
        "floors": project.floors,
        "quality_tier": project.quality_tier,
        "finish_level": project.finish_level,
        "material_preferences": _deserialize(project.material_preferences) or [],
        "estimate": _deserialize(project.estimate),
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


def to_dict_version(version: EstimateVersion):
    return {
        "id": version.id,
        "project_id": version.project_id,
        "name": version.name,
        "estimate": _deserialize(version.estimate),
        "created_at": version.created_at.isoformat(),
    }


def get_config(key: str):
    with session_scope() as db:
        entry = db.get(ConfigEntry, key)
        return _deserialize(entry.value) if entry else None


def set_config(key: str, value):
    with session_scope() as db:
        entry = db.get(ConfigEntry, key)
        encoded = json.dumps(value) if DATABASE_URL.startswith("sqlite") else value
        if entry:
            entry.value = encoded
            entry.updated_at = datetime.utcnow()
        else:
            db.add(ConfigEntry(key=key, value=encoded))
        return value
