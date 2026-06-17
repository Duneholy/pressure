"""Waits router: create, end, edit, reassign, history, generate message."""

import sys
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from ..models import AppSetting, Employee, Task, TaskWait, WaitEndReason
from ..schemas import (
    LLMGenerateResponse, WaitCreate, WaitEnd, WaitOut, WaitReassign, WaitUpdate,
)
from ..services.llm import generate_message_with_llm
from ..services.text_utils import (
    build_fallback_message, deduplicate_name_in_message, detect_gender,
    format_days_ru, format_hours_ru,
)

router = APIRouter(tags=["waits"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


@router.post("/tasks/{task_id}/waits", response_model=WaitOut)
def start_wait(task_id: UUID, payload: WaitCreate, db: Session = Depends()):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    employee = db.get(Employee, payload.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not employee.active:
        raise HTTPException(status_code=400, detail="Employee is inactive")
    active_count = (
        db.query(func.count(TaskWait.id))
        .filter(TaskWait.task_id == task.id, TaskWait.is_active.is_(True))
        .scalar()
    )
    if active_count >= 4:
        raise HTTPException(status_code=400, detail="Task already has 4 active waits")
    dup = (
        db.query(TaskWait)
        .filter(TaskWait.task_id == task.id, TaskWait.employee_id == employee.id, TaskWait.is_active.is_(True))
        .first()
    )
    if dup:
        raise HTTPException(status_code=400, detail="This employee already has an active wait for this task")
    wait = TaskWait(
        task_id=task.id,
        employee_id=employee.id,
        wait_started_at=payload.wait_started_at,
        is_active=True,
        comment=(payload.comment.strip() if payload.comment else None),
    )
    db.add(wait)
    db.commit()
    db.refresh(wait)
    wait = db.query(TaskWait).options(joinedload(TaskWait.employee)).get(wait.id)
    return _wait_to_out(wait)


@router.post("/waits/{wait_id}/end", response_model=WaitOut)
def end_wait(wait_id: UUID, payload: WaitEnd, db: Session = Depends()):
    wait = db.get(TaskWait, wait_id)
    if not wait:
        raise HTTPException(status_code=404, detail="Wait not found")
    if not wait.is_active:
        raise HTTPException(status_code=400, detail="Wait is already ended")
    end_time = payload.wait_ended_at or _utc_now()
    if end_time < wait.wait_started_at:
        raise HTTPException(status_code=400, detail="End time must be >= start time")
    wait.wait_ended_at = end_time
    wait.end_reason = payload.end_reason.value
    wait.is_active = False
    wait.duration_seconds = int((end_time - wait.wait_started_at).total_seconds())
    db.commit()
    wait = db.query(TaskWait).options(joinedload(TaskWait.employee)).get(wait.id)
    return _wait_to_out(wait)


@router.patch("/waits/{wait_id}", response_model=WaitOut)
def update_wait(wait_id: UUID, payload: WaitUpdate, db: Session = Depends()):
    wait = db.get(TaskWait, wait_id)
    if not wait:
        raise HTTPException(status_code=404, detail="Wait not found")
    if not wait.is_active:
        raise HTTPException(status_code=400, detail="Wait is not active")
    data = payload.model_dump(exclude_unset=True)
    if "employee_id" in data and data["employee_id"] is not None:
        new_id = data["employee_id"]
        if new_id != wait.employee_id:
            new_employee = db.get(Employee, new_id)
            if not new_employee:
                raise HTTPException(status_code=404, detail="Employee not found")
            if not new_employee.active:
                raise HTTPException(status_code=400, detail="Employee is inactive")
            dup = (
                db.query(TaskWait)
                .filter(
                    TaskWait.task_id == wait.task_id,
                    TaskWait.employee_id == new_id,
                    TaskWait.is_active.is_(True),
                    TaskWait.id != wait.id,
                )
                .first()
            )
            if dup:
                raise HTTPException(status_code=400, detail="This employee already has an active wait for this task")
            wait.employee_id = new_id
    if "wait_started_at" in data and data["wait_started_at"] is not None:
        wait.wait_started_at = data["wait_started_at"]
    if "comment" in data:
        c = data["comment"]
        wait.comment = (c.strip() if isinstance(c, str) else c) or None
    if "contact_attempts" in data and data["contact_attempts"] is not None:
        wait.contact_attempts = max(0, min(3, int(data["contact_attempts"])))
    db.commit()
    wait = db.query(TaskWait).options(joinedload(TaskWait.employee)).get(wait.id)
    return _wait_to_out(wait)


@router.post("/waits/{wait_id}/reassign", response_model=WaitOut)
def reassign_wait(wait_id: UUID, payload: WaitReassign, db: Session = Depends()):
    current_wait = db.get(TaskWait, wait_id)
    if not current_wait:
        raise HTTPException(status_code=404, detail="Wait not found")
    if not current_wait.is_active:
        raise HTTPException(status_code=400, detail="Wait is already ended")
    new_employee = db.get(Employee, payload.new_employee_id)
    if not new_employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    if not new_employee.active:
        raise HTTPException(status_code=400, detail="Employee is inactive")
    if new_employee.id == current_wait.employee_id:
        raise HTTPException(status_code=400, detail="Reassign employee must be different")
    active_count = (
        db.query(func.count(TaskWait.id))
        .filter(TaskWait.task_id == current_wait.task_id, TaskWait.is_active.is_(True))
        .scalar()
    )
    if active_count >= 4:
        raise HTTPException(status_code=400, detail="Task already has 4 active waits")
    dup = (
        db.query(TaskWait)
        .filter(
            TaskWait.task_id == current_wait.task_id,
            TaskWait.employee_id == new_employee.id,
            TaskWait.is_active.is_(True),
        )
        .first()
    )
    if dup:
        raise HTTPException(status_code=400, detail="This employee already has an active wait for this task")
    end_time = _utc_now()
    current_wait.wait_ended_at = end_time
    current_wait.end_reason = WaitEndReason.reassigned.value
    current_wait.is_active = False
    current_wait.duration_seconds = int((end_time - current_wait.wait_started_at).total_seconds())
    new_wait = TaskWait(
        task_id=current_wait.task_id,
        employee_id=new_employee.id,
        wait_started_at=payload.new_wait_started_at,
        is_active=True,
        comment=(payload.comment.strip() if payload.comment else None),
    )
    db.add(new_wait)
    db.commit()
    db.refresh(new_wait)
    new_wait = db.query(TaskWait).options(joinedload(TaskWait.employee)).get(new_wait.id)
    return _wait_to_out(new_wait)


@router.get("/tasks/{task_id}/wait-history", response_model=list[WaitOut])
def wait_history(task_id: UUID, db: Session = Depends()):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    waits = (
        db.query(TaskWait)
        .options(joinedload(TaskWait.employee))
        .filter(TaskWait.task_id == task_id)
        .order_by(TaskWait.created_at.desc())
        .all()
    )
    return [_wait_to_out(w) for w in waits]


@router.post("/waits/{wait_id}/generate-message", response_model=LLMGenerateResponse)
def generate_message_for_wait(wait_id: UUID, db: Session = Depends()):
    wait = (
        db.query(TaskWait)
        .options(joinedload(TaskWait.employee), joinedload(TaskWait.task))
        .filter(TaskWait.id == wait_id)
        .first()
    )
    if not wait:
        raise HTTPException(status_code=404, detail="Wait not found")
    if not wait.is_active:
        raise HTTPException(status_code=400, detail="Wait is not active")

    api_key = _get_setting(db, "openrouter_api_key")
    model = _get_setting(db, "openrouter_model")

    elapsed_sec = int((_utc_now() - wait.wait_started_at).total_seconds())
    approx_days = int((elapsed_sec + 12 * 3600) // (24 * 3600))
    if approx_days >= 1:
        wait_phrase = "уже " + format_days_ru(approx_days)
    else:
        hours = max(1, elapsed_sec // 3600 or 1)
        wait_phrase = "уже " + format_hours_ru(hours)

    first_name = wait.employee.first_name
    title = wait.task.title
    description = (wait.task.description or "").strip()
    comment = (wait.comment or "").strip()
    contact_attempts = wait.contact_attempts or 0
    gender = detect_gender(first_name)

    task_context = title
    if description:
        task_context += f" — {description}"

    tone_levels = {
        0: "нейтральный, вежливое напоминание",
        1: "настойчивый: первая попытка связи была без ответа, дай это понять",
        2: "требовательный: уже две попытки без ответа, тон серьёзный, без приветствий",
        3: "жёсткий и прямой: три попытки игнорировались, требуй немедленного ответа",
    }
    tone = tone_levels[contact_attempts]
    gender_hint = "женский" if gender == "female" else "мужской"

    comment_instruction = (
        f"Комментарий к ожиданию: «{comment}»\n"
        "Как использовать комментарий:\n"
        f"- Перефразируй его от второго лица на «ты», с правильным родом ({gender_hint})\n"
        f"- Если в нём встречается имя «{first_name}» в любой форме, выкинь его и используй «ты»\n"
        "- Глаголы прошедшего времени согласуй по роду\n"
    ) if comment else "Комментарий: нет\n"

    prompt = (
        f"Сформулируй сообщение коллеге по работе на русском языке.\n"
        f"Тон: {tone}.\n"
        f"Грамматический род адресата: {gender_hint}.\n\n"
        "Жёсткие правила:\n"
        f"1. Имя «{first_name}» используй РОВНО ОДИН раз — в самом начале.\n"
        "2. Суть задачи опиши СВОИМИ словами.\n"
        f"3. Фразу длительности «{wait_phrase}» вставь дословно.\n"
        "4. Длина: 1–2 предложения.\n\n"
        f"Имя сотрудника: {first_name}\n"
        f"Задача: {task_context}\n"
        f"Время ожидания: {wait_phrase}\n"
        f"Попыток связи без ответа: {contact_attempts}\n"
        f"{comment_instruction}"
    )
    fallback_message = build_fallback_message(
        first_name=first_name,
        title=title,
        wait_phrase=wait_phrase,
        comment=comment,
        contact_attempts=contact_attempts,
        gender=gender,
    )
    try:
        message = generate_message_with_llm(prompt, api_key, model)
        print(f"[generate-message] LLM OK (skulls={contact_attempts})", file=sys.stderr)
    except HTTPException as ex:
        print(f"[generate-message] LLM FAILED → fallback (skulls={contact_attempts}): {ex.detail}", file=sys.stderr)
        message = fallback_message
    message = deduplicate_name_in_message(message, first_name)
    return LLMGenerateResponse(message=message)
