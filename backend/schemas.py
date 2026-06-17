"""Pydantic schemas for request/response validation."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from .models import ProjectStatus, TaskStatus, WaitEndReason


# ── Auth ──────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=1)


class UserOut(BaseModel):
    username: str
    created_at: datetime | None = None


# ── Projects ──────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    link: str | None = Field(default=None, max_length=1024)
    status: ProjectStatus = ProjectStatus.active


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    link: str | None = Field(default=None, max_length=1024)
    status: ProjectStatus | None = None


class ProjectOut(BaseModel):
    id: UUID
    name: str
    description: str | None
    link: str | None
    status: ProjectStatus

    class Config:
        from_attributes = True


# ── Employees ─────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    last_name: str = Field(min_length=1, max_length=120)
    first_name: str = Field(min_length=1, max_length=120)
    department: str = Field(min_length=1, max_length=120)


class EmployeeUpdate(BaseModel):
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    department: str | None = Field(default=None, min_length=1, max_length=120)
    active: bool | None = None


class EmployeeOut(BaseModel):
    id: UUID
    last_name: str
    first_name: str
    department: str
    active: bool

    class Config:
        from_attributes = True


# ── Tasks ─────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    project_id: UUID
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    link: str | None = Field(default=None, max_length=1024)
    deadline_at: datetime | None = None
    owner_employee_id: UUID | None = None
    status: TaskStatus = TaskStatus.open


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    link: str | None = Field(default=None, max_length=1024)
    deadline_at: datetime | None = None
    owner_employee_id: UUID | None = None
    status: TaskStatus | None = None


class WaitOut(BaseModel):
    id: UUID
    task_id: UUID
    employee_id: UUID
    employee_name: str
    department: str
    wait_started_at: datetime
    wait_ended_at: datetime | None
    end_reason: WaitEndReason | None
    is_active: bool
    duration_seconds: int | None
    comment: str | None
    contact_attempts: int = 0


class TaskOut(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: str | None
    link: str | None
    deadline_at: datetime | None
    owner_employee_id: UUID | None
    owner_employee_name: str | None
    status: TaskStatus
    active_waits: list[WaitOut]


# ── Waits ─────────────────────────────────────────────────────────

class WaitCreate(BaseModel):
    employee_id: UUID
    wait_started_at: datetime
    comment: str | None = Field(default=None, max_length=2000)


class WaitEnd(BaseModel):
    end_reason: WaitEndReason = WaitEndReason.answered
    wait_ended_at: datetime | None = None


class WaitReassign(BaseModel):
    new_employee_id: UUID
    new_wait_started_at: datetime
    comment: str | None = Field(default=None, max_length=2000)


class WaitUpdate(BaseModel):
    employee_id: UUID | None = None
    wait_started_at: datetime | None = None
    comment: str | None = Field(default=None, max_length=2000)
    contact_attempts: int | None = Field(default=None, ge=0, le=3)


# ── LLM ──────────────────────────────────────────────────────────

class LLMGenerateResponse(BaseModel):
    message: str
    tone: Literal["neutral"] = "neutral"
    language: Literal["ru"] = "ru"
