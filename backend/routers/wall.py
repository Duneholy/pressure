"""Wall of Shame router."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models import AppSetting, Employee, Task, TaskWait

router = APIRouter(tags=["wall"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_crit_days(db: Session) -> int:
    row = db.query(AppSetting).filter(AppSetting.key == "zone_crit_days").first()
    try:
        return int(row.value) if row else 10
    except Exception:
        return 10


@router.get("/wall-of-shame")
def wall_of_shame(db: Session = Depends()):
    now = _utc_now()
    crit_days = _get_crit_days(db)
    red_threshold_sec = crit_days * 24 * 3600
    waits = (
        db.query(TaskWait)
        .options(joinedload(TaskWait.employee))
        .filter(TaskWait.is_active.is_(True))
        .all()
    )
    employee_rows: dict[str, dict] = {}
    for w in waits:
        if not w.employee or not w.employee.active:
            continue
        elapsed = int((now - w.wait_started_at).total_seconds())
        if elapsed < red_threshold_sec:
            continue
        key = str(w.employee_id)
        full_name = f"{w.employee.last_name} {w.employee.first_name}"
        if key not in employee_rows:
            employee_rows[key] = {
                "employee_id": key,
                "employee_name": full_name,
                "tasks_count": 0,
                "max_delay_started_at": None,
            }
        row = employee_rows[key]
        row["tasks_count"] += 1
        prev = row["max_delay_started_at"]
        if prev is None or w.wait_started_at < prev:
            row["max_delay_started_at"] = w.wait_started_at
        row["max_delay_seconds"] = int((now - row["max_delay_started_at"]).total_seconds())
    rows = list(employee_rows.values())
    rows.sort(key=lambda x: (-x["tasks_count"], -x["max_delay_seconds"], x["employee_name"]))
    return rows


@router.get("/wall-of-shame/{employee_id}/tasks")
def wall_of_shame_employee_tasks(employee_id: UUID, db: Session = Depends()):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    now = _utc_now()
    crit_days = _get_crit_days(db)
    red_threshold_sec = crit_days * 24 * 3600
    waits = (
        db.query(TaskWait)
        .options(joinedload(TaskWait.task))
        .filter(TaskWait.employee_id == employee_id, TaskWait.is_active.is_(True))
        .order_by(TaskWait.wait_started_at.asc())
        .all()
    )
    rows = []
    for w in waits:
        elapsed = int((now - w.wait_started_at).total_seconds())
        if elapsed < red_threshold_sec:
            continue
        rows.append({
            "wait_id": str(w.id),
            "task_id": str(w.task_id),
            "task_title": w.task.title,
            "task_status": w.task.status,
            "wait_started_at": w.wait_started_at,
            "elapsed_seconds": elapsed,
            "comment": w.comment,
        })
    return rows
