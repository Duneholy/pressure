"""
Database layer — SQLite multi-user architecture.

Central DB (data/app.db):  user accounts + sessions
Per-user DB (data/users/{username}.db):  projects, tasks, employees, waits, settings
"""

import hashlib
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, String, Text, TypeDecorator,
    create_engine, event,
)
from sqlalchemy.orm import Session, declarative_base, sessionmaker

# ── Paths ─────────────────────────────────────────────────────────

_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("DATA_DIR", str(_ROOT / "data")))
USERS_DB_DIR = DATA_DIR / "users"
APP_DB_PATH = DATA_DIR / "app.db"


# ── GUID type (stores UUID as TEXT in SQLite) ─────────────────────

class GUID(TypeDecorator):
    """Platform-independent UUID stored as 36-char string in SQLite."""
    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if isinstance(value, uuid.UUID):
                return str(value)
            return str(uuid.UUID(str(value)))
        return None

    def process_result_value(self, value, dialect):
        if value is not None:
            return uuid.UUID(value) if not isinstance(value, uuid.UUID) else value
        return None


# ── Bases ─────────────────────────────────────────────────────────

AppBase = declarative_base()
UserBase = declarative_base()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Central DB models (app.db) ────────────────────────────────────

class AppUser(AppBase):
    __tablename__ = "app_users"

    username = Column(String(120), primary_key=True)
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=_utc_now, nullable=False)


class AppSession(AppBase):
    __tablename__ = "app_sessions"

    token = Column(String(64), primary_key=True)
    username = Column(String(120), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)


# ── Password helpers (PBKDF2-HMAC-SHA256 with random salt) ────────

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return salt.hex() + ":" + key.hex()


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return key.hex() == key_hex
    except Exception:
        return False


# ── SQLite pragma helper ──────────────────────────────────────────

def _set_sqlite_pragmas(dbapi_conn, _connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ── Central DB engine & session factory ───────────────────────────

def _make_app_engine():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    eng = create_engine(
        f"sqlite:///{APP_DB_PATH}",
        connect_args={"check_same_thread": False},
    )
    event.listen(eng, "connect", _set_sqlite_pragmas)
    AppBase.metadata.create_all(bind=eng)
    return eng


app_engine = _make_app_engine()
AppSessionLocal = sessionmaker(bind=app_engine, autocommit=False, autoflush=False)


def get_app_db():
    db = AppSessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Per-user DB engine cache & factory ────────────────────────────

_user_engines: dict[str, object] = {}


def get_user_engine(username: str):
    if username in _user_engines:
        return _user_engines[username]
    USERS_DB_DIR.mkdir(parents=True, exist_ok=True)
    db_path = USERS_DB_DIR / f"{username}.db"
    eng = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    event.listen(eng, "connect", _set_sqlite_pragmas)
    UserBase.metadata.create_all(bind=eng)
    _seed_user_defaults(eng)
    _user_engines[username] = eng
    return eng


def _seed_user_defaults(engine):
    """Insert default settings if missing."""
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = SessionLocal()
    try:
        from .models import AppSetting
        existing = db.query(AppSetting).filter(AppSetting.key == "zone_warn_days").first()
        if not existing:
            db.add(AppSetting(key="zone_warn_days", value="3"))
            db.add(AppSetting(key="zone_crit_days", value="10"))
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def get_user_session(username: str) -> Session:
    engine = get_user_engine(username)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return factory()


def delete_user_database(username: str):
    """Remove engine from cache and delete the database file."""
    engine = _user_engines.pop(username, None)
    if engine:
        engine.dispose()
    db_path = USERS_DB_DIR / f"{username}.db"
    for suffix in ("", "-wal", "-shm"):
        p = db_path.parent / (db_path.name + suffix)
        if p.exists():
            p.unlink()
