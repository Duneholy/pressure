"""
SQLAlchemy models for per-user databases (SQLite).
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer, SmallInteger, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import GUID, UserBase


def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Enums ─────────────────────────────────────────────────────────

class ProjectStatus(str, enum.Enum):
    active = "active"
    done = "done"
    on_hold = "on_hold"


class TaskStatus(str, enum.Enum):
    open = "open"
    blocked = "blocked"
    done = "done"


class WaitEndReason(str, enum.Enum):
    answered = "answered"
    reassigned = "reassigned"
    cancelled = "cancelled"


# ── Models ────────────────────────────────────────────────────────

class Project(UserBase):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    link: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=ProjectStatus.active.value)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, onupdate=_utc_now, nullable=False)

    tasks: Mapped[list["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Employee(UserBase):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    department: Mapped[str] = mapped_column(String(120), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, onupdate=_utc_now, nullable=False)

    waits: Mapped[list["TaskWait"]] = relationship(back_populates="employee")


class Task(UserBase):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    link: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    owner_employee_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=TaskStatus.open.value)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, onupdate=_utc_now, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="tasks")
    owner_employee: Mapped["Employee | None"] = relationship(foreign_keys=[owner_employee_id])
    waits: Mapped[list["TaskWait"]] = relationship(back_populates="task", cascade="all, delete-orphan")


class TaskWait(UserBase):
    __tablename__ = "task_waits"
    __table_args__ = (
        Index("ix_task_waits_active", "task_id", "is_active"),
        Index("ix_task_waits_employee_active", "employee_id", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("tasks.id"), nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("employees.id"), nullable=False)
    wait_started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    wait_ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_reason: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_attempts: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, onupdate=_utc_now, nullable=False)

    task: Mapped["Task"] = relationship(back_populates="waits")
    employee: Mapped["Employee"] = relationship(back_populates="waits")


class AppSetting(UserBase):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(String(4000), nullable=False)
