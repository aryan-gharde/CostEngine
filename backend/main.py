import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import admin, ai, auth, documents, estimate, flat_plan, project, scenario
from services.database import init_db

app = FastAPI(title="Construction Cost Intelligence Platform API", version="1.0.0")

frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
if frontend_url:
    allowed_origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Construction Cost Intelligence API"}


app.include_router(auth.router)
app.include_router(project.router)
app.include_router(estimate.router)
app.include_router(ai.router)
app.include_router(scenario.router)
app.include_router(admin.router)
app.include_router(documents.router)
app.include_router(flat_plan.router)
