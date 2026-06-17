"""Tasks router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..models import Employee, Project, Task, TaskStatus, TaskWait
from ..schemas import TaskCreate, TaskOut, TaskUpdate, WaitOut

router = APIRouter(tags=["tasks"])


def _wait_to_out(wait: TaskWait) -> WaitOut:
    full_name = f"{wait.employee.last_name} {wait.employee.first_name}"
    return WaitOut(
        id=wait.id,
        task_id=wait.task_id,
        employee_id=wait.employee_id,
        employee_name=full_name,
        department=wait.employee.department,
        wait_started_at=wait.wait_started_at,
        wait_ended_at=wait.wait_ended_at,
        end_reason=wait.end_reason,
        is_active=wait.is_active,
        duration_seconds=wait.duration_seconds,
        comment=wait.comment,
        contact_attempts=wait.contact_attempts or 0,
    )


def _task_to_out(task: Task) -> TaskOut:
    active_waits = [_wait_to_out(w) for w in task.waits if w.is_active and w.employee and w.employee.active]
    return TaskOut(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        link=task.link,
        deadline_at=task.deadline_at,
        owner_employee_id=task.owner_employee_id,
        owner_employee_name=(
            f"{task.owner_employee.last_name} {task.owner_employee.first_name}"
            if task.owner_employee
            else None
        ),
        status=task.status,
        active_waits=active_waits,
    )


def _load_task_full(db: Session, task_id):
    return (
        db.query(Task)
        .options(joinedload(Task.waits).joinedload(TaskWait.employee), joinedload(Task.owner_employee))
        .get(task_id)
    )


@router.get("/projects/{project_id}/tasks", response_model=list[TaskOut])
def list_project_tasks(project_id: UUID, db: Session = Depends()):
    if db.get(Project, project_id) is None:
        raise HTTPException(status_code=404, detail="Project not found")
    tasks = (
        db.query(Task)
        .options(joinedload(Task.waits).joinedload(TaskWait.employee), joinedload(Task.owner_employee))
        .filter(Task.project_id == project_id)
        .order_by(Task.created_at.desc())
        .all()
    )
    return [_task_to_out(task) for task in tasks]


@router.post("/tasks", response_model=TaskOut)
def create_task(payload: TaskCreate, db: Session = Depends()):
    if not db.get(Project, payload.project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.owner_employee_id and not db.get(Employee, payload.owner_employee_id):
        raise HTTPException(status_code=404, detail="Owner employee not found")
    task = Task(
        project_id=payload.project_id,
        title=payload.title.strip(),
        description=payload.description,
        link=payload.link.strip() if payload.link else None,
        deadline_at=payload.deadline_at,
        owner_employee_id=payload.owner_employee_id,
        status=payload.status.value,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    task = _load_task_full(db, task.id)
    return _task_to_out(task)


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    project_id: UUID | None = Query(default=None),
    status: TaskStatus | None = Query(default=None),
    db: Session = Depends(),
):
    query = db.query(Task).options(
        joinedload(Task.waits).joinedload(TaskWait.employee),
        joinedload(Task.owner_employee),
    )
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if status:
        query = query.filter(Task.status == status.value)
    tasks = query.order_by(Task.created_at.desc()).all()
    return [_task_to_out(task) for task in tasks]


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskUpdate, db: Session = Depends()):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    data = payload.model_dump(exclude_unset=True)
    if "link" in data and data["link"] is not None:
        data["link"] = data["link"].strip() or None
    if "owner_employee_id" in data and data["owner_employee_id"] is not None:
        if not db.get(Employee, data["owner_employee_id"]):
            raise HTTPException(status_code=404, detail="Owner employee not found")
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value if hasattr(data["status"], "value") else data["status"]
    for field, value in data.items():
        setattr(task, field, value)
    db.commit()
    task = _load_task_full(db, task.id)
    return _task_to_out(task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: UUID, db: Session = Depends()):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return None
