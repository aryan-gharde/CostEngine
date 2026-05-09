from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import admin, ai, auth, documents, estimate, project, scenario
from services.database import init_db
# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# Application metadata constants
_API_TITLE       = "Construction Cost Intelligence Platform API"
_API_VERSION     = "1.0.0"
_API_DESCRIPTION = (
    "AI-powered construction cost estimation, document parsing, "
    "and intelligent analytics system.\n\n"
    "All endpoints are versioned under `/api/v1`."
)

# Lifespan replaces deprecated @app.on_event("startup")
# Keeps identical DB-init behaviour; no breaking change.
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup tasks before the application begins serving requests."""
    logger.info("Starting up %s v%s …", _API_TITLE, _API_VERSION)
    init_db()
    logger.info("Database initialised successfully.")
    yield
    # shutdown 
    logger.info("Shutting down %s.", _API_TITLE)

# FastAPI application
app = FastAPI(
    title=_API_TITLE,
    version=_API_VERSION,
    description=_API_DESCRIPTION,
    # Surface /docs and /redoc from the root so existing bookmarks still work
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS unchanged from original
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://cost-engine.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Routers all prefixed under /api/v1 with Swagger tags
app.include_router(auth.router,      prefix="/api/v1/auth",      tags=["Auth"])
app.include_router(project.router,   prefix="/api/v1/projects",  tags=["Projects"])
app.include_router(estimate.router,  prefix="/api/v1/estimate",  tags=["Estimate"])
app.include_router(ai.router,        prefix="/api/v1/ai",        tags=["AI"])
app.include_router(scenario.router,  prefix="/api/v1/scenario",  tags=["Scenario"])
app.include_router(admin.router,     prefix="/api/v1/admin",     tags=["Admin"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"])

logger.info("Routers registered under /api/v1")
# Health check primary liveness probe
@app.get(
    "/health",
    tags=["Health"],
    summary="Liveness probe",
    response_description="Service status and version",
)
def health_check() -> dict:
    """
    Lightweight endpoint used by load balancers and monitoring tools to
    confirm the service is running.

    Returns service name, API version, and the current UTC timestamp.
    """
    return {
        "status":    "ok",
        "service":   _API_TITLE,
        "version":   _API_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
# Root kept for backward compatibility with any frontend hitting "/"
@app.get(
    "/",
    tags=["Health"],
    summary="Root — basic service info",
    response_description="Service name and link to docs",
)
def root() -> dict:
    """
    Backward-compatible root endpoint.  Previously served as the health
    check; traffic should now be directed to /health.
    """
    return {
        "service": _API_TITLE,
        "version": _API_VERSION,
        "docs":    "/docs",
        "health":  "/health",
    }
