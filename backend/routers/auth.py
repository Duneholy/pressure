"""Auth router: multi-user management + session-based login with SQLite storage."""

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from ..database import (
    AppSession, AppSessionLocal, AppUser, app_engine,
    delete_user_database, get_app_db, get_user_engine,
    hash_password, verify_password,
)
from ..schemas import UserCreate, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_COOKIE = "pressure_session"
SESSION_TTL_HOURS = 8


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def session_username(request: Request) -> str | None:
    """Read session cookie, look up in DB, return username or None."""
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    db = AppSessionLocal()
    try:
        row = db.query(AppSession).filter(AppSession.token == token).first()
        if not row:
            return None
        if row.expires_at <= _now():
            db.delete(row)
            db.commit()
            return None
        return row.username
    finally:
        db.close()


def cleanup_expired_sessions():
    """Remove all expired sessions from the central DB."""
    db = AppSessionLocal()
    try:
        now = _now()
        db.query(AppSession).filter(AppSession.expires_at <= now).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_app_db)):
    users = db.query(AppUser).order_by(AppUser.created_at.asc()).all()
    return [UserOut(username=u.username, created_at=u.created_at) for u in users]


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(payload: UserCreate, db: Session = Depends(get_app_db)):
    username = payload.username.strip().lower()
    if not username:
        raise HTTPException(status_code=400, detail="Имя пользователя не может быть пустым")
    existing = db.query(AppUser).filter(AppUser.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь с таким именем уже существует")
    user = AppUser(
        username=username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    # Pre-create the user database with default tables
    get_user_engine(username)
    return UserOut(username=user.username, created_at=user.created_at)


@router.delete("/users/{username}", status_code=204)
def delete_user(username: str, payload: dict, db: Session = Depends(get_app_db)):
    """Delete a user account and their database. Requires password confirmation."""
    user = db.query(AppUser).filter(AppUser.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    password = payload.get("password", "")
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=403, detail="Неверный пароль")
    # Remove sessions
    db.query(AppSession).filter(AppSession.username == username).delete(synchronize_session=False)
    db.delete(user)
    db.commit()
    # Remove user database file
    delete_user_database(username)
    return None


@router.post("/login")
def login(payload: dict, response: Response, db: Session = Depends(get_app_db)):
    username = (payload.get("username") or "").strip().lower()
    password = payload.get("password") or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="Введите логин и пароль")
    user = db.query(AppUser).filter(AppUser.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    # Create session
    token = secrets.token_urlsafe(32)
    now = _now()
    session = AppSession(
        token=token,
        username=username,
        expires_at=now + timedelta(hours=SESSION_TTL_HOURS),
    )
    db.add(session)
    db.commit()
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        max_age=SESSION_TTL_HOURS * 3600,
        path="/",
    )
    return {"ok": True, "username": username}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db = AppSessionLocal()
        try:
            db.query(AppSession).filter(AppSession.token == token).delete(synchronize_session=False)
            db.commit()
        finally:
            db.close()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    username = session_username(request)
    if not username:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return {"username": username}
