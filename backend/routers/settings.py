"""Settings router: zone thresholds + OpenRouter LLM configuration."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..models import AppSetting

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_int(db: Session, key: str, default: int) -> int:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row:
        return default
    try:
        return int(row.value)
    except Exception:
        return default


def _set_val(db: Session, key: str, value: str):
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


# ── Zone thresholds ───────────────────────────────────────────────

@router.get("/zones")
def get_zones(db: Session = Depends()):
    return {
        "warn_days": _get_int(db, "zone_warn_days", 3),
        "crit_days": _get_int(db, "zone_crit_days", 10),
    }


@router.put("/zones")
def update_zones(payload: dict, db: Session = Depends()):
    warn_days = int(payload.get("warn_days", 3))
    crit_days = int(payload.get("crit_days", 10))
    if warn_days < 1 or crit_days < 1:
        raise HTTPException(status_code=400, detail="Days must be >= 1")
    if warn_days >= crit_days:
        raise HTTPException(status_code=400, detail="warn_days must be < crit_days")
    _set_val(db, "zone_warn_days", str(warn_days))
    _set_val(db, "zone_crit_days", str(crit_days))
    db.commit()
    return {"warn_days": warn_days, "crit_days": crit_days}


# ── LLM (OpenRouter) ─────────────────────────────────────────────

@router.get("/llm")
def get_llm_settings(db: Session = Depends()):
    api_key = _get_val(db, "openrouter_api_key", "")
    model = _get_val(db, "openrouter_model", "")
    # Mask the API key for display
    masked = ""
    if api_key:
        masked = api_key[:8] + "…" + api_key[-4:] if len(api_key) > 12 else "••••"
    return {"api_key_masked": masked, "api_key_set": bool(api_key), "model": model}


@router.put("/llm")
def update_llm_settings(payload: dict, db: Session = Depends()):
    api_key = payload.get("api_key")
    model = payload.get("model")
    if api_key is not None:
        _set_val(db, "openrouter_api_key", api_key.strip())
    if model is not None:
        _set_val(db, "openrouter_model", model.strip())
    db.commit()
    return {"ok": True}


def _get_val(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default
