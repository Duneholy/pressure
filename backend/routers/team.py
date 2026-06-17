"""Team overview router."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..models import Employee, Task, TaskWait

router = APIRouter(tags=["team"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/team")
def team_overview(db: Session = Depends()):
    employees = (
        db.query(Employee)
        .filter(Employee.active.is_(True))
        .order_by(Employee.department, Employee.last_name)
        .all()
    )
    waits = (
        db.query(TaskWait)
        .options(joinedload(TaskWait.employee))
        .filter(TaskWait.is_active.is_(True))
        .all()
    )
    stats: dict[str, dict] = {}
    for e in employees:
        key = str(e.id)
        stats[key] = {
            "employee_id": key,
            "employee_name": f"{e.last_name} {e.first_name}",
            "department": e.department,
            "active_tasks": 0,
            "skulls_open": 0,
            "skulls_max": 0,
        }
    for w in waits:
        if not w.employee or not w.employee.active:
            continue
        key = str(w.employee_id)
        if key not in stats:
            continue
        row = stats[key]
        row["active_tasks"] += 1
        row["skulls_open"] += int(w.contact_attempts or 0)
        row["skulls_max"] += 3
    rows = list(stats.values())
    for row in rows:
        max_skulls = row["skulls_max"] or 1
        burden_ratio = row["skulls_open"] / max_skulls
        row["burden_ratio"] = burden_ratio
        row["rating"] = round(max(0.0, 10.0 * (1.0 - burden_ratio)), 2)
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        dept = row["department"] or "Без отдела"
        grouped.setdefault(dept, []).append(row)
    for dept_rows in grouped.values():
        dept_rows.sort(key=lambda x: (x["rating"], -x["skulls_open"], x["employee_name"]))
    return grouped


@router.get("/team/{employee_id}/tasks")
def team_employee_tasks(employee_id: UUID, db: Session = Depends()):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    waits = (
        db.query(TaskWait)
        .options(joinedload(TaskWait.task).joinedload(Task.project))
        .filter(TaskWait.employee_id == employee_id, TaskWait.is_active.is_(True))
        .all()
    )
    rows = []
    now = _utc_now()
    for w in waits:
        if not w.task or not w.task.project:
            continue
        rows.append({
            "project_name": w.task.project.name,
            "task_title": w.task.title,
            "task_link": w.task.link,
            "comment": w.comment,
            "wait_started_at": w.wait_started_at,
            "elapsed_seconds": int((now - w.wait_started_at).total_seconds()),
        })
    rows.sort(key=lambda x: (x["project_name"], x["task_title"]))
    return rows
