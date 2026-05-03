from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import admin, ai, auth, documents, estimate, project, scenario
from services.database import init_db

app = FastAPI(title="Construction Cost Intelligence Platform API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://cost-engine.onrender.com",],
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
