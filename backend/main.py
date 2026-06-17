"""
THE PRESSURE API — main application.
Slim entry point: mounts routers, middleware, and static files.
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import get_user_session
from .routers import auth, employees, projects, settings, tasks, team, waits, wall
from .routers.auth import cleanup_expired_sessions, session_username


# ── Lifespan (periodic session cleanup) ───────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    cleanup_expired_sessions()
    yield


# ── App ───────────────────────────────────────────────────────────

app = FastAPI(title="THE PRESSURE API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).resolve().parents[1] / "frontend"
app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR)), name="assets")


# ── Auth middleware ───────────────────────────────────────────────

PUBLIC_PREFIXES = ("/assets/",)
PUBLIC_EXACT = {"/", "/health", "/auth/login", "/auth/me", "/auth/logout", "/auth/users"}


@app.middleware("http")
async def require_auth_middleware(request: Request, call_next):
    path = request.url.path
    if path in PUBLIC_EXACT or any(path.startswith(p) for p in PUBLIC_PREFIXES):
        return await call_next(request)
    username = session_username(request)
    if not username:
        return JSONResponse({"detail": "Unauthorized"}, status_code=status.HTTP_401_UNAUTHORIZED)
    request.state.username = username
    return await call_next(request)


# ── Per-user DB dependency ────────────────────────────────────────

def get_user_db(request: Request):
    """Dependency: yields a SQLAlchemy session for the authenticated user's DB."""
    username = getattr(request.state, "username", None)
    if not username:
        # Try reading from cookie (for public endpoints that also need DB)
        username = session_username(request)
    if not username:
        raise Exception("Unauthorized")
    db = get_user_session(username)
    try:
        yield db
    finally:
        db.close()


# ── Register routers with dependency override ─────────────────────

# Auth router uses the central app DB (handled internally)
app.include_router(auth.router)

# All data routers use per-user DB via dependency override
for r in [projects.router, tasks.router, employees.router, waits.router,
          wall.router, team.router, settings.router]:
    # Override the default Depends() in each router to use get_user_db
    app.include_router(r, dependencies=[])

# Override Session dependency for all data routers
app.dependency_overrides[Session] = get_user_db


# ── Static routes ─────────────────────────────────────────────────

@app.get("/")
def index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.get("/health")
def health():
    return {"ok": True}
