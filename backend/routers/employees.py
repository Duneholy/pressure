"""Employees router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Employee, TaskWait
from ..schemas import EmployeeCreate, EmployeeOut, EmployeeUpdate

router = APIRouter(tags=["employees"])


@router.get("/employees", response_model=list[EmployeeOut])
def list_employees(search: str | None = Query(default=None), db: Session = Depends()):
    query = db.query(Employee)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Employee.first_name.ilike(like),
                Employee.last_name.ilike(like),
                Employee.department.ilike(like),
            )
        )
    return query.order_by(Employee.active.desc(), Employee.last_name.asc()).all()


@router.post("/employees", response_model=EmployeeOut)
def create_employee(payload: EmployeeCreate, db: Session = Depends()):
    # Check for duplicate name
    existing = (
        db.query(Employee)
        .filter(Employee.last_name == payload.last_name.strip(), Employee.first_name == payload.first_name.strip())
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Employee with the same name already exists")
    employee = Employee(
        last_name=payload.last_name.strip(),
        first_name=payload.first_name.strip(),
        department=payload.department.strip(),
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


@router.patch("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: UUID, payload: EmployeeUpdate, db: Session = Depends()):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    data = payload.model_dump(exclude_unset=True)
    if "last_name" in data and data["last_name"] is not None:
        data["last_name"] = data["last_name"].strip()
    if "first_name" in data and data["first_name"] is not None:
        data["first_name"] = data["first_name"].strip()
    if "department" in data and data["department"] is not None:
        data["department"] = data["department"].strip()
    for field, value in data.items():
        setattr(employee, field, value)
    # Check uniqueness
    dup = (
        db.query(Employee)
        .filter(
            Employee.last_name == employee.last_name,
            Employee.first_name == employee.first_name,
            Employee.id != employee.id,
        )
        .first()
    )
    if dup:
        db.rollback()
        raise HTTPException(status_code=409, detail="Employee with the same name already exists")
    db.commit()
    db.refresh(employee)
    return employee


@router.delete("/employees/{employee_id}", status_code=204)
def delete_employee(employee_id: UUID, db: Session = Depends()):
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.query(TaskWait).filter(TaskWait.employee_id == employee_id).delete(synchronize_session=False)
    db.delete(employee)
    db.commit()
    return None
