import hashlib
import uuid

from fastapi import APIRouter, HTTPException

from models.schemas import AuthRequest
from services.database import SessionToken, User, session_scope

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash(password: str):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _session_payload(user, token):
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.post("/signup")
def signup(payload: AuthRequest):
    with session_scope() as db:
        existing = db.query(User).filter(User.email == payload.email.lower()).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email is already registered")
        user = User(name=payload.name or payload.email.split("@")[0], email=payload.email.lower(), password_hash=_hash(payload.password))
        db.add(user)
        db.flush()
        token = str(uuid.uuid4())
        db.add(SessionToken(token=token, user_id=user.id))
        db.flush()
        return _session_payload(user, token)


@router.post("/login")
def login(payload: AuthRequest):
    with session_scope() as db:
        user = db.query(User).filter(User.email == payload.email.lower()).first()
        if not user or user.password_hash != _hash(payload.password):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        token = str(uuid.uuid4())
        db.add(SessionToken(token=token, user_id=user.id))
        db.flush()
        return _session_payload(user, token)

