import json
import os
from contextlib import contextmanager
from datetime import datetime
from hashlib import sha256

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, JSON, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./construction_cost_demo.db")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SessionToken(Base):
    __tablename__ = "session_tokens"

    token = Column(String(255), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    location = Column(String(255), nullable=False)
    area = Column(Float, nullable=False)
    floors = Column(Integer, nullable=False)
    quality_tier = Column(String(80), default="Medium", nullable=False)
    finish_level = Column(String(80), default="Standard", nullable=False)
    material_preferences = Column(JSON, default=list, nullable=False)
    estimate = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class EstimateVersion(Base):
    __tablename__ = "estimate_versions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    estimate = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AppConfig(Base):
    __tablename__ = "app_config"

    key = Column(String(255), primary_key=True)
    value = Column(JSON, default=dict, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


DEFAULT_CONFIG = {
    "material_prices": {
        "steel": 62500,
        "cement": 410,
        "sand": 72,
        "aggregate": 96,
        "copper": 820,
    },
    "templates": {},
}


def _loads(value, fallback):
    if value is None:
        return fallback
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


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


def to_dict_project(project):
    return {
        "id": project.id,
        "user_id": project.user_id,
        "name": project.name,
        "location": project.location,
        "area": project.area,
        "floors": project.floors,
        "quality_tier": project.quality_tier,
        "finish_level": project.finish_level,
        "material_preferences": _loads(project.material_preferences, []),
        "estimate": _loads(project.estimate, {}),
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


def to_dict_version(version):
    return {
        "id": version.id,
        "project_id": version.project_id,
        "name": version.name,
        "estimate": _loads(version.estimate, {}),
        "created_at": version.created_at.isoformat() if version.created_at else None,
    }


def get_config(key):
    with session_scope() as db:
        config = db.get(AppConfig, key)
        if config:
            return _loads(config.value, {})
        return DEFAULT_CONFIG.get(key, {})


def set_config(key, value):
    with session_scope() as db:
        config = db.get(AppConfig, key)
        if not config:
            config = AppConfig(key=key, value=value)
            db.add(config)
        else:
            config.value = value
            config.updated_at = datetime.utcnow()
        db.flush()
        return _loads(config.value, {})


def init_db():
    Base.metadata.create_all(bind=engine)
    with session_scope() as db:
        demo = db.query(User).filter(User.email == "demo@siteiq.in").first()
        if not demo:
            db.add(
                User(
                    name="Demo User",
                    email="demo@siteiq.in",
                    password_hash=sha256("demo12345".encode("utf-8")).hexdigest(),
                )
            )