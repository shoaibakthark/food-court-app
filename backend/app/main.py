
from datetime import date as DateType, datetime
import os
import base64
import subprocess
from decimal import Decimal
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app import crud, schemas, models


# ============================================================
# APP SETUP & AUTOMATIC TABLE CREATION
# ============================================================

app = FastAPI(title="Food Court API")

# Ensure all database tables exist on startup and seed default accounts
try:
    models.Base.metadata.create_all(bind=engine)
    with SessionLocal() as db_init:
        if db_init.query(models.User).count() == 0:
            db_init.add_all([
                models.User(username="admin", password="admin123", name="Administrator", role="admin"),
                models.User(username="owner", password="owner123", name="Owner", role="owner"),
                models.User(username="manager", password="manager123", name="Manager", role="manager"),
            ])
            db_init.commit()
            print("Successfully initialized default users: admin, owner, manager")
except Exception as init_err:
    print(f"Database initialization notice: {init_err}")


app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROLE-BASED ACCESS CONTROL MIDDLEWARE
# - 'admin': Full access to all modules and actions
# - 'owner': Read-only access to all modules
# - 'manager': Staff payment page only
# ============================================================

@app.middleware("http")
async def role_access_middleware(request, call_next):
    user_role = request.headers.get("X-User-Role")
    path = request.url.path

    if user_role == "owner":
        if request.method in ["POST", "PUT", "DELETE"] and not path.startswith("/auth"):
            from starlette.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "Read-only access: Owner role cannot create, modify, or delete data."}
            )

    if user_role == "manager":
        allowed_prefixes = ["/staff", "/staff-payments", "/staff-roles", "/kitchen", "/auth", "/docs", "/openapi.json"]
        if path != "/" and not any(path.startswith(p) for p in allowed_prefixes):
            from starlette.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "Access restricted: Manager role has access only to Staff, Kitchen, and Staff Payments."}
            )

    response = await call_next(request)
    return response


# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# AUTHENTICATION & LOGIN ENDPOINTS
# ============================================================

class LoginPayload(BaseModel):
    username: str
    password: str


@app.post("/auth/login")
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    username = payload.username.strip()
    password = payload.password.strip()

    user = db.query(models.User).filter(func.lower(models.User.username) == username.lower()).first()
    if not user or user.password != password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    allowed_pages = ["*"]
    if user.role == "manager":
        allowed_pages = ["/staff", "/staff-payments", "/kitchen"]

    return {
        "id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "token": f"fc-session-{user.role}-{user.id}",
        "permissions": {
            "all": user.role == "admin",
            "read_only": user.role == "owner",
            "manager_only": user.role == "manager",
            "allowed_pages": allowed_pages,
        }
    }


@app.get("/auth/users")
def get_auth_users(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "name": u.name,
            "role": u.role,
        }
        for u in users
    ]


@app.get("/auth/roles")
def get_auth_roles():
    return [
        {
            "role": "admin",
            "title": "Admin",
            "badge": "Full Access",
            "description": "Full access to all modules, financial ledgers, and actions.",
            "default_username": "admin",
            "default_password": "admin123",
        },
        {
            "role": "owner",
            "title": "Owner",
            "badge": "Read Only",
            "description": "Complete view of reports, revenue, events, and ledgers without edit/delete rights.",
            "default_username": "owner",
            "default_password": "owner123",
        },
        {
            "role": "manager",
            "title": "Manager",
            "badge": "Staff Payments Only",
            "description": "Dedicated access to the Staff directory and Staff Wage Disbursements.",
            "default_username": "manager",
            "default_password": "manager123",
        },
    ]


# ============================================================
# BASIC / DATABASE TEST
# ============================================================

@app.get("/")
def root():
    return {"message": "Food Court API is running"}


@app.get("/test-db")
def test_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"message": "Database connection successful"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(e)}",
        )


# ============================================================
# CUSTOMERS
# ============================================================

@app.post("/customers", response_model=schemas.CustomerResponse)
def create_customer(
    customer: schemas.CustomerCreate,
    db: Session = Depends(get_db),
):
    try:
        return crud.create_customer(db, customer)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create customer: {str(e)}",
        )


@app.get("/customers")
def get_customers(db: Session = Depends(get_db)):
    try:
        customers = db.query(models.Customer).all()
        result = []

        for customer in customers:
            event_count = (
                db.query(models.Event)
                .filter(models.Event.customer_id == customer.id)
                .count()
            )

            result.append({
                "id": customer.id,
                "name": customer.name,
                "mobile": customer.mobile,
                "event_count": event_count,
            })

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get customers: {str(e)}",
        )


@app.get("/customers/{customer_id}")
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
):
    customer = (
        db.query(models.Customer)
        .filter(models.Customer.id == customer_id)
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    return {
        "id": customer.id,
        "name": customer.name,
        "mobile": customer.mobile,
    }


class CustomerUpdateRequest(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None


@app.put("/customers/{customer_id}")
def update_customer(
    customer_id: int,
    payload: CustomerUpdateRequest,
    db: Session = Depends(get_db),
):
    customer = (
        db.query(models.Customer)
        .filter(models.Customer.id == customer_id)
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    try:
        for field, value in payload.model_dump(
            exclude_unset=True
        ).items():
            if value is not None and hasattr(customer, field):
                setattr(
                    customer,
                    field,
                    value.strip() if isinstance(value, str) else value,
                )

        db.commit()
        db.refresh(customer)

        return {
            "id": customer.id,
            "name": customer.name,
            "mobile": customer.mobile,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update customer: {str(e)}",
        )


@app.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
):
    customer = (
        db.query(models.Customer)
        .filter(models.Customer.id == customer_id)
        .first()
    )

    if customer is None:
        raise HTTPException(
            status_code=404,
            detail="Customer not found",
        )

    try:
        db.delete(customer)
        db.commit()
        return {"message": "Customer deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete customer: {str(e)}",
        )


# ============================================================
# EVENTS
# ============================================================

def event_to_dict(event, db: Session):
    """Return event information together with the customer's name."""
    customer = (
        db.query(models.Customer)
        .filter(models.Customer.id == event.customer_id)
        .first()
    )

    paid_sum = (
        db.query(func.coalesce(func.sum(models.EventPayment.amount), 0))
        .filter(models.EventPayment.event_id == event.id)
        .scalar()
    ) or Decimal("0")

    effective_quote = event.quote if event.quote is not None else (event.total_estimate or Decimal("0"))
    balance = max(Decimal("0"), Decimal(str(effective_quote)) - Decimal(str(paid_sum)))

    return {
        "id": event.id,
        "date": event.date,
        "guest_count": event.guest_count,
        "food_amt": event.food_amt,
        "total_estimate": event.total_estimate,
        "place": event.place,
        "customer_id": event.customer_id,
        "customer_name": customer.name if customer else "Unknown Customer",
        "customer_mobile": customer.mobile if customer else "",
        "event_type": event.event_type,
        "decor_amt": event.decor_amt,
        "quote": event.quote,
        "paid_amount": float(paid_sum),
        "balance": float(balance),
    }


@app.post("/events")
def create_event(
    event: schemas.CreateEventRequest,
    db: Session = Depends(get_db),
):
    try:
        created_event = crud.create_complete_event(db, event)
        db.refresh(created_event)
        return event_to_dict(created_event, db)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create event: {str(e)}",
        )


@app.get("/events")
def get_events(db: Session = Depends(get_db)):
    try:
        events = db.query(models.Event).all()
        result = [event_to_dict(event, db) for event in events]

        result.sort(
            key=lambda item: (
                item["date"] is None,
                str(item["date"] or ""),
                item["id"],
            )
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get events: {str(e)}",
        )


@app.get("/events/{event_id}")
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(models.Event)
        .filter(models.Event.id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    return event_to_dict(event, db)


class EventUpdateRequest(BaseModel):
    date: Optional[DateType] = None
    guest_count: Optional[int] = None
    food_amt: Optional[Decimal] = None
    total_estimate: Optional[Decimal] = None
    place: Optional[str] = None
    customer_id: Optional[int] = None
    event_type: Optional[str] = None
    decor_amt: Optional[Decimal] = None
    quote: Optional[Decimal] = None

    @field_validator("date", mode="before")
    @classmethod
    def empty_date_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value


@app.put("/events/{event_id}")
def update_event(
    event_id: int,
    payload: EventUpdateRequest,
    db: Session = Depends(get_db),
):
    event = (
        db.query(models.Event)
        .filter(models.Event.id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    try:
        update_data = payload.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if not hasattr(event, field):
                continue

            if field == "date" and value is None:
                continue

            if value is None:
                continue

            if isinstance(value, str):
                value = value.strip()

            setattr(event, field, value)

        db.commit()
        db.refresh(event)

        return event_to_dict(event, db)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update event: {str(e)}",
        )


@app.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(models.Event)
        .filter(models.Event.id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    try:
        db.delete(event)
        db.commit()
        return {"message": "Event deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete event: {str(e)}",
        )


# ============================================================
# EVENT MENU ITEMS AND EVENT DECOR ITEMS
# ============================================================

class EventMenuItemSave(BaseModel):
    food_item_id: int
    quantity: int
    price: Decimal


class EventDecorItemSave(BaseModel):
    decor_item_id: int
    quantity: int
    price: Decimal


def get_existing_event(event_id: int, db: Session):
    event = (
        db.query(models.Event)
        .filter(models.Event.id == event_id)
        .first()
    )

    if event is None:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    return event


def update_event_cost_totals(event, db: Session):
    """Recalculate menu, decor and combined totals."""

    food_rows = (
        db.query(models.EventFoodItem)
        .filter(models.EventFoodItem.event_id == event.id)
        .all()
    )

    decor_rows = (
        db.query(models.EventDecor)
        .filter(models.EventDecor.event_id == event.id)
        .all()
    )

    food_total = sum(
        (
            Decimal(str(row.qty or 0))
            * Decimal(str(row.price or 0))
            for row in food_rows
        ),
        Decimal("0"),
    )

    decor_total = sum(
        (
            Decimal(str(row.qty or 0))
            * Decimal(str(row.price or 0))
            for row in decor_rows
        ),
        Decimal("0"),
    )

    event.food_amt = food_total
    event.decor_amt = decor_total
    event.total_estimate = food_total + decor_total


# ------------------------------------------------------------
# EVENT MENU: LOAD
# ------------------------------------------------------------

@app.get("/events/{event_id}/menu-items")
def get_event_menu_items(
    event_id: int,
    db: Session = Depends(get_db),
):
    get_existing_event(event_id, db)

    rows = (
        db.query(models.EventFoodItem, models.FoodItem)
        .join(
            models.FoodItem,
            models.EventFoodItem.food_item_id == models.FoodItem.id,
        )
        .filter(models.EventFoodItem.event_id == event_id)
        .all()
    )

    return [
        {
            "id": food_item.id,
            "food_item_id": food_item.id,
            "name": food_item.name,
            "quantity": event_item.qty,
            "price": event_item.price,
            "unit_price": event_item.price,
            "session_id": food_item.session_id,
        }
        for event_item, food_item in rows
    ]


# ------------------------------------------------------------
# EVENT MENU: SAVE
# ------------------------------------------------------------

@app.put("/events/{event_id}/menu-items")
def save_event_menu_items(
    event_id: int,
    items: list[EventMenuItemSave],
    db: Session = Depends(get_db),
):
    event = get_existing_event(event_id, db)

    try:
        seen_ids = set()

        for item in items:
            if item.food_item_id in seen_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate food item ID: {item.food_item_id}",
                )

            seen_ids.add(item.food_item_id)

            if item.quantity < 0 or item.price < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Quantity and price cannot be negative",
                )

            food_item = (
                db.query(models.FoodItem)
                .filter(models.FoodItem.id == item.food_item_id)
                .first()
            )

            if food_item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Food item {item.food_item_id} not found",
                )

        db.query(models.EventFoodItem).filter(
            models.EventFoodItem.event_id == event_id
        ).delete(synchronize_session=False)

        db.add_all([
            models.EventFoodItem(
                event_id=event_id,
                food_item_id=item.food_item_id,
                qty=item.quantity,
                price=item.price,
            )
            for item in items
        ])

        db.flush()
        update_event_cost_totals(event, db)

        db.commit()
        db.refresh(event)

        return {
            "message": "Event menu saved successfully",
            "event_id": event_id,
            "item_count": len(items),
            "food_amt": event.food_amt,
            "decor_amt": event.decor_amt,
            "total_estimate": event.total_estimate,
        }

    except Exception as e:
        db.rollback()

        if isinstance(e, HTTPException):
            raise

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save event menu: {str(e)}",
        )


# ------------------------------------------------------------
# EVENT DECOR: LOAD
# ------------------------------------------------------------

@app.get("/events/{event_id}/decor-items")
def get_event_decor_items(
    event_id: int,
    db: Session = Depends(get_db),
):
    get_existing_event(event_id, db)

    rows = (
        db.query(models.EventDecor, models.DecorItem)
        .join(
            models.DecorItem,
            models.EventDecor.decor_id == models.DecorItem.id,
        )
        .filter(models.EventDecor.event_id == event_id)
        .all()
    )

    return [
        {
            "id": decor_item.id,
            "decor_item_id": decor_item.id,
            "name": decor_item.name,
            "quantity": event_decor.qty,
            "price": event_decor.price,
            "unit_price": event_decor.price,
            "session_id": getattr(decor_item, "session_id", None),
        }
        for event_decor, decor_item in rows
    ]


# ------------------------------------------------------------
# EVENT DECOR: SAVE
# ------------------------------------------------------------

@app.put("/events/{event_id}/decor-items")
def save_event_decor_items(
    event_id: int,
    items: list[EventDecorItemSave],
    db: Session = Depends(get_db),
):
    event = get_existing_event(event_id, db)

    try:
        seen_ids = set()

        for item in items:
            if item.decor_item_id in seen_ids:
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate decor item ID: {item.decor_item_id}",
                )

            seen_ids.add(item.decor_item_id)

            if item.quantity < 0 or item.price < 0:
                raise HTTPException(
                    status_code=400,
                    detail="Quantity and price cannot be negative",
                )

            decor_item = (
                db.query(models.DecorItem)
                .filter(models.DecorItem.id == item.decor_item_id)
                .first()
            )

            if decor_item is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"Decor item {item.decor_item_id} not found",
                )

        db.query(models.EventDecor).filter(
            models.EventDecor.event_id == event_id
        ).delete(synchronize_session=False)

        db.add_all([
            models.EventDecor(
                event_id=event_id,
                decor_id=item.decor_item_id,
                qty=item.quantity,
                price=item.price,
            )
            for item in items
        ])

        db.flush()
        update_event_cost_totals(event, db)

        db.commit()
        db.refresh(event)

        return {
            "message": "Event decor saved successfully",
            "event_id": event_id,
            "item_count": len(items),
            "food_amt": event.food_amt,
            "decor_amt": event.decor_amt,
            "total_estimate": event.total_estimate,
        }

    except Exception as e:
        db.rollback()

        if isinstance(e, HTTPException):
            raise

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save event decor: {str(e)}",
        )


# ============================================================
# STAFF ROLES
# ============================================================

@app.post(
    "/staff-roles",
    response_model=schemas.StaffRoleResponse,
)
def create_staff_role(
    staff_role: schemas.StaffRoleCreate,
    db: Session = Depends(get_db),
):
    try:
        return crud.create_staff_role(db, staff_role)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create staff role: {str(e)}",
        )


@app.get(
    "/staff-roles",
    response_model=list[schemas.StaffRoleResponse],
)
def get_staff_roles(db: Session = Depends(get_db)):
    try:
        return crud.get_staff_roles(db)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get staff roles: {str(e)}",
        )


# ============================================================
# STAFF
# ============================================================

class StaffUpdatePayload(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    role_id: Optional[int] = None
    salary: Optional[Decimal] = None
    daily_wage: Optional[Decimal] = None
    address: Optional[str] = None


@app.post("/staff", response_model=schemas.StaffResponse)
def create_staff(
    staff: schemas.StaffCreate,
    db: Session = Depends(get_db),
):
    try:
        return crud.create_staff(db, staff)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create staff: {str(e)}",
        )


@app.get("/staff")
def get_staff(db: Session = Depends(get_db)):
    try:
        staff_members = db.query(models.Staff).all()
        roles_map = {r.id: r for r in db.query(models.StaffRole).all()}

        # Collect event assignments and payments to compute worked events and earnings
        assigned_rows = db.query(models.EventStaff.staff_id, models.EventStaff.event_id).all()
        paid_rows = db.query(models.StaffPayment.staff_id, models.StaffPayment.event_id, models.StaffPayment.payment).all()

        worked_events_by_staff: dict[int, set[int]] = {}
        for sid, eid in assigned_rows:
            worked_events_by_staff.setdefault(sid, set()).add(eid)

        payments_by_staff: dict[int, float] = {}
        for sid, eid, p_amt in paid_rows:
            if eid:
                worked_events_by_staff.setdefault(sid, set()).add(eid)
            payments_by_staff[sid] = payments_by_staff.get(sid, 0.0) + float(p_amt or 0)

        result = []
        for staff in staff_members:
            ro = roles_map.get(staff.role_id) if staff.role_id else None
            role_wage = float(ro.wage) if ro and ro.wage is not None else 0.0
            daily_wage = float(getattr(staff, "daily_wage", None) or role_wage)

            worked_eids = worked_events_by_staff.get(staff.id, set())
            events_count = len(worked_eids)
            total_earnings = events_count * daily_wage
            total_paid = payments_by_staff.get(staff.id, 0.0)
            pending_balance = max(0.0, total_earnings - total_paid)

            result.append({
                "id": staff.id,
                "name": staff.name,
                "mobile": staff.mobile,
                "role_id": getattr(staff, "role_id", None),
                "role_name": ro.role if ro else "General Staff",
                "salary": getattr(staff, "salary", None),
                "wage": daily_wage,
                "daily_wage": daily_wage,
                "address": getattr(staff, "address", None),
                "events_count": events_count,
                "total_earnings": total_earnings,
                "total_paid": total_paid,
                "pending_balance": pending_balance,
            })

        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get staff: {str(e)}",
        )


@app.get("/staff/{staff_id}")
def get_single_staff_details(
    staff_id: int,
    db: Session = Depends(get_db),
):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff member not found")

    role = db.query(models.StaffRole).filter(models.StaffRole.id == staff.role_id).first() if staff.role_id else None
    role_wage = float(role.wage) if role and role.wage is not None else 0.0
    daily_wage = float(getattr(staff, "daily_wage", None) or role_wage)

    # Worked event IDs from event_staff AND staff_payments
    assigned_event_ids = {
        row[0] for row in db.query(models.EventStaff.event_id).filter(models.EventStaff.staff_id == staff_id).all()
    }
    paid_event_ids = {
        row[0] for row in db.query(models.StaffPayment.event_id).filter(
            models.StaffPayment.staff_id == staff_id,
            models.StaffPayment.event_id.isnot(None)
        ).all()
    }
    all_event_ids = assigned_event_ids.union(paid_event_ids)

    # Fetch events & customers
    events = db.query(models.Event).filter(models.Event.id.in_(all_event_ids)).all() if all_event_ids else []
    cust_ids = {e.customer_id for e in events if e.customer_id}
    customers = {c.id: c for c in db.query(models.Customer).filter(models.Customer.id.in_(cust_ids)).all()} if cust_ids else {}

    # Fetch all payments for this staff member
    payments_raw = (
        db.query(models.StaffPayment)
        .filter(models.StaffPayment.staff_id == staff_id)
        .order_by(models.StaffPayment.id.desc())
        .all()
    )

    payments_by_event: dict[int, float] = {}
    total_paid = 0.0
    payment_records = []
    events_map = {e.id: e for e in events}

    for p in payments_raw:
        amt = float(p.payment or 0)
        total_paid += amt
        if p.event_id:
            payments_by_event[p.event_id] = payments_by_event.get(p.event_id, 0.0) + amt

        ev = events_map.get(p.event_id)
        p_date = getattr(p, "payment_date", None)
        if not p_date and ev and ev.date:
            p_date = ev.date

        payment_records.append({
            "id": p.id,
            "event_id": p.event_id,
            "payment": amt,
            "amount": amt,
            "payment_date": str(p_date) if p_date else None,
            "note": p.note,
            "event_type": ev.event_type if ev else "Direct Wage Disbursement",
            "place": ev.place if ev else None,
        })

    # Worked events list & earnings
    worked_events = []
    total_earnings = 0.0

    for ev in events:
        cust = customers.get(ev.customer_id)
        ev_wage = daily_wage if daily_wage > 0 else 0.0
        total_earnings += ev_wage
        ev_paid = payments_by_event.get(ev.id, 0.0)
        ev_balance = max(0.0, ev_wage - ev_paid)

        worked_events.append({
            "event_id": ev.id,
            "date": str(ev.date) if ev.date else None,
            "event_type": ev.event_type or "Event",
            "place": ev.place or "-",
            "customer_name": cust.name if cust else "Unknown Customer",
            "customer_mobile": cust.mobile if cust else None,
            "role_name": role.role if role else "General Staff",
            "wage": ev_wage,
            "paid": ev_paid,
            "balance": ev_balance,
            "status": "Settled" if (ev_balance == 0 and ev_paid > 0) else ("Partially Paid" if ev_paid > 0 else ("No Wage Set" if ev_wage == 0 else "Unpaid")),
        })

    worked_events.sort(key=lambda x: str(x["date"] or ""), reverse=True)
    pending_balance = max(0.0, total_earnings - total_paid)

    return {
        "id": staff.id,
        "name": staff.name,
        "mobile": staff.mobile,
        "role_id": staff.role_id,
        "role_name": role.role if role else "General Staff",
        "wage": daily_wage,
        "daily_wage": daily_wage,
        "salary": getattr(staff, "salary", None),
        "address": getattr(staff, "address", None),
        "total_earnings": total_earnings,
        "total_paid": total_paid,
        "pending_balance": pending_balance,
        "events_count": len(worked_events),
        "worked_events": worked_events,
        "payments": payment_records,
    }


@app.put("/staff/{staff_id}")
def update_staff(
    staff_id: int,
    payload: StaffUpdatePayload,
    db: Session = Depends(get_db),
):
    staff = (
        db.query(models.Staff)
        .filter(models.Staff.id == staff_id)
        .first()
    )

    if staff is None:
        raise HTTPException(
            status_code=404,
            detail="Staff member not found",
        )

    try:
        update_data = payload.model_dump(exclude_unset=True)

        allowed_fields = {
            "name",
            "mobile",
            "role_id",
            "salary",
            "daily_wage",
            "address",
        }

        for field, value in update_data.items():
            if field in allowed_fields and hasattr(staff, field):
                if isinstance(value, str):
                    value = value.strip()
                setattr(staff, field, value)

        db.commit()
        db.refresh(staff)

        return {
            "id": staff.id,
            "name": staff.name,
            "mobile": staff.mobile,
            "role_id": getattr(staff, "role_id", None),
            "salary": getattr(staff, "salary", None),
            "daily_wage": getattr(staff, "daily_wage", None),
            "address": getattr(staff, "address", None),
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update staff: {str(e)}",
        )


@app.delete("/staff/{staff_id}")
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
):
    staff = (
        db.query(models.Staff)
        .filter(models.Staff.id == staff_id)
        .first()
    )

    if staff is None:
        raise HTTPException(
            status_code=404,
            detail="Staff member not found",
        )

    try:
        db.delete(staff)
        db.commit()
        return {"message": "Staff deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete staff: {str(e)}",
        )


# ============================================================
# STAFF PAYMENTS
# ============================================================

@app.post("/staff-payments")
def create_staff_payment_endpoint(
    payload: dict,
    db: Session = Depends(get_db),
):
    try:
        raw_staff_id = payload.get("staff_id")
        if not raw_staff_id:
            raise HTTPException(status_code=400, detail="staff_id is required")
        staff_id = int(raw_staff_id)

        staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")

        amount_raw = payload.get("payment", payload.get("amount", 0))
        amount = Decimal(str(amount_raw))
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

        event_id_raw = payload.get("event_id")
        event_id = int(event_id_raw) if event_id_raw else None

        date_val = payload.get("payment_date") or payload.get("date")
        if date_val and isinstance(date_val, str) and date_val.strip():
            from datetime import datetime
            try:
                parsed_date = datetime.strptime(date_val.strip()[:10], "%Y-%m-%d").date()
            except ValueError:
                parsed_date = DateType.today()
        else:
            parsed_date = DateType.today()

        note = str(payload.get("note") or "").strip() or None

        payment_obj = models.StaffPayment(
            event_id=event_id,
            staff_id=staff_id,
            payment=amount,
            payment_date=parsed_date,
            note=note,
        )
        db.add(payment_obj)

        if event_id:
            existing_assign = (
                db.query(models.EventStaff)
                .filter(models.EventStaff.event_id == event_id, models.EventStaff.staff_id == staff_id)
                .first()
            )
            if not existing_assign:
                db.add(models.EventStaff(event_id=event_id, staff_id=staff_id))

        db.commit()
        db.refresh(payment_obj)

        role = db.query(models.StaffRole).filter(models.StaffRole.id == staff.role_id).first() if staff.role_id else None

        return {
            "id": payment_obj.id,
            "event_id": payment_obj.event_id,
            "staff_id": payment_obj.staff_id,
            "payment": float(payment_obj.payment),
            "amount": float(payment_obj.payment),
            "payment_date": str(payment_obj.payment_date) if payment_obj.payment_date else None,
            "note": payment_obj.note,
            "staff_name": staff.name,
            "staff_role": role.role if role else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create staff payment: {str(e)}",
        )


@app.get("/staff-payments")
def get_staff_payments_enriched(db: Session = Depends(get_db)):
    try:
        payments = db.query(models.StaffPayment).order_by(models.StaffPayment.id.desc()).all()
        staff_map = {s.id: s for s in db.query(models.Staff).all()}
        role_map = {r.id: r for r in db.query(models.StaffRole).all()}
        event_map = {e.id: e for e in db.query(models.Event).all()}

        result = []
        for p in payments:
            st = staff_map.get(p.staff_id)
            ro = role_map.get(st.role_id) if st and st.role_id else None
            ev = event_map.get(p.event_id) if p.event_id else None

            p_date = getattr(p, "payment_date", None)
            if not p_date and ev and ev.date:
                p_date = ev.date

            result.append({
                "id": p.id,
                "event_id": p.event_id,
                "staff_id": p.staff_id,
                "payment": float(p.payment),
                "amount": float(p.payment),
                "payment_date": str(p_date) if p_date else None,
                "note": p.note,
                "staff_name": st.name if st else f"Staff #{p.staff_id}",
                "staff_role": ro.role if ro else None,
                "event_type": ev.event_type if ev else "General Duty",
                "place": ev.place if ev else None,
            })
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get staff payments: {str(e)}",
        )


@app.delete("/staff-payments/{payment_id}")
def delete_staff_payment(
    payment_id: int,
    db: Session = Depends(get_db),
):
    payment = (
        db.query(models.StaffPayment)
        .filter(models.StaffPayment.id == payment_id)
        .first()
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="Staff payment not found")

    try:
        db.delete(payment)
        db.commit()
        return {"message": "Staff payment deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete staff payment: {str(e)}",
        )


# ============================================================
# EVENT STAFF ASSIGNMENTS
# ============================================================

@app.get("/events/{event_id}/staff")
def get_event_staff_assignments(event_id: int, db: Session = Depends(get_db)):
    try:
        records = db.query(models.EventStaff).filter(models.EventStaff.event_id == event_id).all()
        staff_ids = [r.staff_id for r in records]
        staff_list = db.query(models.Staff).filter(models.Staff.id.in_(staff_ids)).all() if staff_ids else []
        roles = {r.id: r for r in db.query(models.StaffRole).all()}

        result = []
        for s in staff_list:
            ro = roles.get(s.role_id)
            result.append({
                "id": s.id,
                "name": s.name,
                "mobile": s.mobile,
                "role_id": s.role_id,
                "role_name": ro.role if ro else "Staff",
                "wage": float(ro.wage) if ro and ro.wage else (float(s.daily_wage) if getattr(s, "daily_wage", None) else 0),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get event staff: {str(e)}")


@app.post("/events/{event_id}/staff")
def assign_event_staff(event_id: int, payload: dict, db: Session = Depends(get_db)):
    try:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        staff_ids = payload.get("staff_ids", [])
        if "staff_id" in payload and payload["staff_id"]:
            staff_ids.append(int(payload["staff_id"]))

        for sid in staff_ids:
            sid_int = int(sid)
            existing = (
                db.query(models.EventStaff)
                .filter(models.EventStaff.event_id == event_id, models.EventStaff.staff_id == sid_int)
                .first()
            )
            if not existing:
                db.add(models.EventStaff(event_id=event_id, staff_id=sid_int))

        db.commit()
        return {"message": "Staff assigned successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to assign staff: {str(e)}")


@app.put("/events/{event_id}/staff")
def sync_event_staff(event_id: int, payload: dict, db: Session = Depends(get_db)):
    try:
        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        raw_ids = payload.get("staff_ids", [])
        staff_ids = [int(sid) for sid in raw_ids if sid is not None and str(sid).strip()]

        # Remove staff not in current list
        if staff_ids:
            db.query(models.EventStaff).filter(
                models.EventStaff.event_id == event_id,
                ~models.EventStaff.staff_id.in_(staff_ids)
            ).delete(synchronize_session=False)
        else:
            db.query(models.EventStaff).filter(
                models.EventStaff.event_id == event_id
            ).delete(synchronize_session=False)

        # Add staff in current list if not already existing
        existing_sids = {
            r[0] for r in db.query(models.EventStaff.staff_id).filter(models.EventStaff.event_id == event_id).all()
        }
        for sid in staff_ids:
            if sid not in existing_sids:
                db.add(models.EventStaff(event_id=event_id, staff_id=sid))

        db.commit()
        return {"message": "Event staff synced successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to sync event staff: {str(e)}")


@app.delete("/events/{event_id}/staff/{staff_id}")
def remove_event_staff(event_id: int, staff_id: int, db: Session = Depends(get_db)):
    try:
        record = (
            db.query(models.EventStaff)
            .filter(models.EventStaff.event_id == event_id, models.EventStaff.staff_id == staff_id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=404, detail="Staff assignment not found")
        db.delete(record)
        db.commit()
        return {"message": "Staff removed from event"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove staff: {str(e)}")


# ============================================================
# EVENT PAYMENTS (Client / Customer Payments)
# ============================================================

@app.post(
    "/events/{event_id}/payments",
    response_model=schemas.EventPaymentResponse,
)
def create_event_payment_for_event(
    event_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    event = (
        db.query(models.Event)
        .filter(models.Event.id == event_id)
        .first()
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    try:
        amount_raw = payload.get("amount", 0)
        amount = Decimal(str(amount_raw))
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

        date_val = payload.get("payment_date") or payload.get("date")
        if date_val and isinstance(date_val, str) and date_val.strip():
            from datetime import datetime
            try:
                parsed_date = datetime.strptime(date_val.strip()[:10], "%Y-%m-%d").date()
            except ValueError:
                parsed_date = DateType.today()
        else:
            parsed_date = DateType.today()

        payment_obj = schemas.EventPaymentCreate(
            event_id=event_id,
            amount=amount,
            payment_method=str(payload.get("payment_method") or "Cash").strip(),
            payment_type=str(payload.get("payment_type") or "Advance").strip(),
            payment_date=parsed_date,
            note=str(payload.get("note") or "").strip() or None,
        )
        return crud.create_event_payment(db, payment_obj)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create event payment: {str(e)}",
        )


@app.get(
    "/events/{event_id}/payments",
    response_model=list[schemas.EventPaymentResponse],
)
def get_event_payments(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = (
        db.query(models.Event)
        .filter(models.Event.id == event_id)
        .first()
    )
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    try:
        return crud.get_event_payments(db, event_id)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get event payments: {str(e)}",
        )


@app.delete("/events/{event_id}/payments/{payment_id}")
def delete_event_payment_by_event(
    event_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
):
    payment = (
        db.query(models.EventPayment)
        .filter(
            models.EventPayment.id == payment_id,
            models.EventPayment.event_id == event_id,
        )
        .first()
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    try:
        db.delete(payment)
        db.commit()
        return {"message": "Payment deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete payment: {str(e)}",
        )


@app.delete("/event-payments/{payment_id}")
def delete_event_payment_direct(
    payment_id: int,
    db: Session = Depends(get_db),
):
    payment = (
        db.query(models.EventPayment)
        .filter(models.EventPayment.id == payment_id)
        .first()
    )
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")

    try:
        db.delete(payment)
        db.commit()
        return {"message": "Payment deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete payment: {str(e)}",
        )


@app.get("/payments")
def get_all_payments_ledger(db: Session = Depends(get_db)):
    try:
        payments = (
            db.query(models.EventPayment)
            .order_by(models.EventPayment.payment_date.desc(), models.EventPayment.id.desc())
            .all()
        )
        events_by_id = {e.id: e for e in db.query(models.Event).all()}
        customers_by_id = {c.id: c for c in db.query(models.Customer).all()}

        results = []
        for p in payments:
            ev = events_by_id.get(p.event_id)
            cust = customers_by_id.get(ev.customer_id) if ev else None
            results.append({
                "id": p.id,
                "event_id": p.event_id,
                "amount": float(p.amount),
                "payment_method": p.payment_method or "Cash",
                "payment_type": p.payment_type or "Advance",
                "payment_date": str(p.payment_date) if p.payment_date else None,
                "note": p.note,
                "event_type": ev.event_type if ev else "Event",
                "event_date": str(ev.date) if ev and ev.date else None,
                "place": ev.place if ev else None,
                "customer_name": cust.name if cust else "Unknown Customer",
                "customer_mobile": cust.mobile if cust else None,
                "quote": float(ev.quote) if ev and ev.quote is not None else (float(ev.total_estimate) if ev and ev.total_estimate else 0),
            })
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payments: {str(e)}")


@app.post("/payments")
def create_payment_direct_ledger(
    payload: dict,
    db: Session = Depends(get_db),
):
    try:
        raw_event_id = payload.get("event_id")
        if not raw_event_id:
            raise HTTPException(status_code=400, detail="event_id is required")
        event_id = int(raw_event_id)

        amount_raw = payload.get("amount", 0)
        amount = Decimal(str(amount_raw))
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

        event = db.query(models.Event).filter(models.Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        date_val = payload.get("payment_date") or payload.get("date")
        if date_val and isinstance(date_val, str) and date_val.strip():
            from datetime import datetime
            try:
                parsed_date = datetime.strptime(date_val.strip()[:10], "%Y-%m-%d").date()
            except ValueError:
                parsed_date = DateType.today()
        else:
            parsed_date = DateType.today()

        payment_obj = schemas.EventPaymentCreate(
            event_id=event_id,
            amount=amount,
            payment_method=str(payload.get("payment_method") or "Cash").strip(),
            payment_type=str(payload.get("payment_type") or "Advance").strip(),
            payment_date=parsed_date,
            note=str(payload.get("note") or "").strip() or None,
        )
        return crud.create_event_payment(db, payment_obj)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create payment: {str(e)}")


@app.delete("/payments/{payment_id}")
def delete_payment_ledger(
    payment_id: int,
    db: Session = Depends(get_db),
):
    payment = crud.delete_event_payment(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return {"message": "Payment deleted successfully"}


# ============================================================
# EXPENSES
# ============================================================

@app.get("/expenses")
def get_expenses_ledger(
    event_id: Optional[int] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    try:
        expenses = crud.get_expenses(db, event_id=event_id, category=category)
        event_ids = {e.event_id for e in expenses if e.event_id is not None}
        events = {}
        if event_ids:
            events = {
                ev.id: ev
                for ev in db.query(models.Event).filter(models.Event.id.in_(event_ids)).all()
            }

        result = []
        for exp in expenses:
            ev = events.get(exp.event_id)
            result.append({
                "id": exp.id,
                "title": exp.title,
                "category": exp.category,
                "amount": float(exp.amount),
                "expense_date": str(exp.expense_date),
                "event_id": exp.event_id,
                "payment_method": exp.payment_method or "Cash",
                "vendor": exp.vendor,
                "bill_number": exp.bill_number,
                "note": exp.note,
                "event_type": ev.event_type if ev else None,
                "event_place": ev.place if ev else None,
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get expenses: {str(e)}")


@app.post("/expenses")
def create_expense_endpoint(
    payload: dict,
    db: Session = Depends(get_db),
):
    try:
        title = str(payload.get("title", "")).strip()
        if not title:
            raise HTTPException(status_code=400, detail="Expense title is required")

        amount_raw = payload.get("amount", 0)
        amount = Decimal(str(amount_raw))
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Amount must be greater than zero")

        date_val = payload.get("expense_date") or payload.get("date")
        if date_val and isinstance(date_val, str) and date_val.strip():
            from datetime import datetime
            try:
                parsed_date = datetime.strptime(date_val.strip()[:10], "%Y-%m-%d").date()
            except ValueError:
                parsed_date = DateType.today()
        else:
            parsed_date = DateType.today()

        event_id = payload.get("event_id")
        if event_id:
            try:
                event_id = int(event_id)
            except (ValueError, TypeError):
                event_id = None

        expense_obj = schemas.ExpenseCreate(
            title=title,
            category=str(payload.get("category") or "Miscellaneous").strip(),
            amount=amount,
            expense_date=parsed_date,
            event_id=event_id,
            payment_method=str(payload.get("payment_method") or "Cash").strip(),
            vendor=str(payload.get("vendor") or "").strip() or None,
            bill_number=str(payload.get("bill_number") or "").strip() or None,
            note=str(payload.get("note") or "").strip() or None,
        )
        created = crud.create_expense(db, expense_obj)
        return {
            "id": created.id,
            "title": created.title,
            "category": created.category,
            "amount": float(created.amount),
            "expense_date": str(created.expense_date),
            "event_id": created.event_id,
            "payment_method": created.payment_method,
            "vendor": created.vendor,
            "bill_number": created.bill_number,
            "note": created.note,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create expense: {str(e)}")


# ============================================================
# EXPENSE SETTLEMENTS (CLEAR LEDGER AMOUNTS)
# ============================================================

@app.get("/expenses/settlements")
def get_expense_settlements(
    vendor: Optional[str] = None,
    db: Session = Depends(get_db),
):
    try:
        models.Base.metadata.create_all(bind=engine)
        query = db.query(models.ExpenseSettlement)
        if vendor and vendor.strip():
            query = query.filter(models.ExpenseSettlement.vendor.ilike(f"%{vendor.strip()}%"))
        settlements = query.order_by(models.ExpenseSettlement.settlement_date.desc(), models.ExpenseSettlement.id.desc()).all()
        return [
            {
                "id": s.id,
                "vendor": s.vendor,
                "amount": float(s.amount),
                "settlement_date": str(s.settlement_date),
                "payment_mode": s.payment_mode or "Cash",
                "reference_no": s.reference_no,
                "note": s.note,
            }
            for s in settlements
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get settlements: {str(e)}")


@app.post("/expenses/settlements")
def create_expense_settlement(
    payload: dict,
    db: Session = Depends(get_db),
):
    try:
        models.Base.metadata.create_all(bind=engine)
        vendor = str(payload.get("vendor", "")).strip()
        if not vendor:
            raise HTTPException(status_code=400, detail="Vendor / Payee name is required")

        amount_raw = payload.get("amount", 0)
        amount = Decimal(str(amount_raw))
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Settlement amount must be greater than zero")

        # Outstanding credit balance check: prevent excess or duplicate clearances
        vendor_expenses = db.query(models.Expense).filter(
            models.Expense.vendor.ilike(vendor)
        ).all()

        credit_expenses = [
            e for e in vendor_expenses
            if e.payment_method and any(
                term in e.payment_method.lower()
                for term in ("credit", "account", "due", "payable")
            )
        ]
        total_credit = sum((Decimal(str(e.amount or 0)) for e in credit_expenses), Decimal("0"))

        vendor_settlements = db.query(models.ExpenseSettlement).filter(
            models.ExpenseSettlement.vendor.ilike(vendor)
        ).all()
        total_cleared = sum((Decimal(str(s.amount or 0)) for s in vendor_settlements), Decimal("0"))

        pending_balance = max(Decimal("0"), total_credit - total_cleared)

        if pending_balance <= Decimal("0"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot record clearance: Supplier '{vendor}' has ₹0 outstanding credit due (already fully settled).",
            )

        if amount > pending_balance:
            raise HTTPException(
                status_code=400,
                detail=f"Clearance amount (₹{amount:,.2f}) exceeds the outstanding credit balance of ₹{pending_balance:,.2f} for '{vendor}'. Maximum allowed clearance is ₹{pending_balance:,.2f}.",
            )

        date_val = payload.get("settlement_date") or payload.get("date")
        if date_val and isinstance(date_val, str) and date_val.strip():
            from datetime import datetime
            try:
                parsed_date = datetime.strptime(date_val.strip()[:10], "%Y-%m-%d").date()
            except ValueError:
                parsed_date = DateType.today()
        else:
            parsed_date = DateType.today()

        settlement = models.ExpenseSettlement(
            vendor=vendor,
            amount=amount,
            settlement_date=parsed_date,
            payment_mode=str(payload.get("payment_mode") or "Cash").strip(),
            reference_no=str(payload.get("reference_no") or "").strip() or None,
            note=str(payload.get("note") or "").strip() or None,
        )
        db.add(settlement)
        db.commit()
        db.refresh(settlement)
        return {
            "id": settlement.id,
            "vendor": settlement.vendor,
            "amount": float(settlement.amount),
            "settlement_date": str(settlement.settlement_date),
            "payment_mode": settlement.payment_mode,
            "reference_no": settlement.reference_no,
            "note": settlement.note,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record settlement: {str(e)}")


@app.delete("/expenses/settlements/{settlement_id}")
def delete_expense_settlement(
    settlement_id: int,
    db: Session = Depends(get_db),
):
    try:
        settlement = db.query(models.ExpenseSettlement).filter(models.ExpenseSettlement.id == settlement_id).first()
        if not settlement:
            raise HTTPException(status_code=404, detail="Settlement not found")
        db.delete(settlement)
        db.commit()
        return {"message": "Settlement deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete settlement: {str(e)}")





@app.get("/expenses/{expense_id}")
def get_single_expense(
    expense_id: int,
    db: Session = Depends(get_db),
):
    expense = crud.get_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    ev = db.query(models.Event).filter(models.Event.id == expense.event_id).first() if expense.event_id else None
    return {
        "id": expense.id,
        "title": expense.title,
        "category": expense.category,
        "amount": float(expense.amount),
        "expense_date": str(expense.expense_date),
        "event_id": expense.event_id,
        "payment_method": expense.payment_method,
        "vendor": expense.vendor,
        "bill_number": expense.bill_number,
        "note": expense.note,
        "event_type": ev.event_type if ev else None,
        "event_place": ev.place if ev else None,
    }


@app.put("/expenses/{expense_id}")
def update_expense_endpoint(
    expense_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    try:
        expense = crud.get_expense(db, expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")

        if "title" in payload and payload["title"] is not None:
            expense.title = str(payload["title"]).strip()
        if "category" in payload and payload["category"] is not None:
            expense.category = str(payload["category"]).strip()
        if "amount" in payload and payload["amount"] is not None:
            expense.amount = Decimal(str(payload["amount"]))
        if "expense_date" in payload and payload["expense_date"] is not None:
            from datetime import datetime
            try:
                expense.expense_date = datetime.strptime(str(payload["expense_date"])[:10], "%Y-%m-%d").date()
            except ValueError:
                pass
        if "event_id" in payload:
            raw_eid = payload["event_id"]
            expense.event_id = int(raw_eid) if raw_eid else None
        if "payment_method" in payload:
            expense.payment_method = str(payload["payment_method"] or "Cash").strip()
        if "vendor" in payload:
            expense.vendor = str(payload["vendor"]).strip() if payload["vendor"] else None
        if "bill_number" in payload:
            expense.bill_number = str(payload["bill_number"]).strip() if payload["bill_number"] else None
        if "note" in payload:
            expense.note = str(payload["note"]).strip() if payload["note"] else None

        db.commit()
        db.refresh(expense)
        return {
            "id": expense.id,
            "title": expense.title,
            "category": expense.category,
            "amount": float(expense.amount),
            "expense_date": str(expense.expense_date),
            "event_id": expense.event_id,
            "payment_method": expense.payment_method,
            "vendor": expense.vendor,
            "bill_number": expense.bill_number,
            "note": expense.note,
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update expense: {str(e)}")


@app.delete("/expenses/{expense_id}")
def delete_expense_endpoint(
    expense_id: int,
    db: Session = Depends(get_db),
):
    expense = crud.delete_expense(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"message": "Expense deleted successfully"}


# ============================================================
# SUB-TEAMS
# ============================================================

@app.post(
    "/sub-teams",
    response_model=schemas.SubTeamResponse,
)
def create_sub_team(
    sub_team: schemas.SubTeamCreate,
    db: Session = Depends(get_db),
):
    try:
        return crud.create_sub_team(db, sub_team)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create sub-team: {str(e)}",
        )


@app.get(
    "/sub-teams",
    response_model=list[schemas.SubTeamResponse],
)
def get_sub_teams(db: Session = Depends(get_db)):
    try:
        return crud.get_sub_teams(db)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get sub-teams: {str(e)}",
        )


@app.delete("/sub-teams/{team_id}")
def delete_sub_team(
    team_id: int,
    db: Session = Depends(get_db),
):
    team = db.query(models.SubTeam).filter(models.SubTeam.id == team_id).first()
    if team is None:
        raise HTTPException(status_code=404, detail="Sub team not found")
    try:
        db.delete(team)
        db.commit()
        return {"message": "Sub team deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete sub team: {str(e)}")


# ============================================================
# FOOD MENU SESSIONS
# ============================================================

@app.post("/sessions")
def create_session(
    payload: dict,
    db: Session = Depends(get_db),
):
    name = str(payload.get("name", "")).strip()
    price = payload.get("price")

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Session name is required",
        )

    session = models.Session(name=name, price=price)

    try:
        db.add(session)
        db.commit()
        db.refresh(session)

        return {
            "id": session.id,
            "name": session.name,
            "price": session.price,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create session: {str(e)}",
        )


@app.get("/sessions")
def get_sessions(db: Session = Depends(get_db)):
    try:
        sessions = db.query(models.Session).all()

        return [
            {
                "id": item.id,
                "name": item.name,
                "price": item.price,
            }
            for item in sessions
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get sessions: {str(e)}",
        )


@app.put("/sessions/{session_id}")
def update_session(
    session_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.Session)
        .filter(models.Session.id == session_id)
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    try:
        if "name" in payload:
            session.name = str(payload["name"]).strip()

        if "price" in payload:
            session.price = payload["price"]

        db.commit()
        db.refresh(session)

        return {
            "id": session.id,
            "name": session.name,
            "price": session.price,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update session: {str(e)}",
        )


@app.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.Session)
        .filter(models.Session.id == session_id)
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found",
        )

    try:
        db.delete(session)
        db.commit()
        return {"message": "Session deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete session: {str(e)}",
        )


# ============================================================
# FOOD ITEMS
# ============================================================

@app.post("/food-items")
def create_food_item(
    food_item: schemas.FoodItemCreate,
    db: Session = Depends(get_db),
):
    try:
        item = models.FoodItem(**food_item.model_dump())
        db.add(item)
        db.commit()
        db.refresh(item)

        return {
            "id": item.id,
            "name": item.name,
            "price": item.price,
            "session_id": item.session_id,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create food item: {str(e)}",
        )


@app.get("/food-items")
def get_food_items(db: Session = Depends(get_db)):
    try:
        items = db.query(models.FoodItem).all()

        return [
            {
                "id": item.id,
                "name": item.name,
                "price": item.price,
                "session_id": item.session_id,
            }
            for item in items
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get food items: {str(e)}",
        )


@app.put("/food-items/{item_id}")
def update_food_item(
    item_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    item = (
        db.query(models.FoodItem)
        .filter(models.FoodItem.id == item_id)
        .first()
    )

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Food item not found",
        )

    try:
        for field in ("name", "price", "session_id"):
            if field in payload:
                setattr(item, field, payload[field])

        db.commit()
        db.refresh(item)

        return {
            "id": item.id,
            "name": item.name,
            "price": item.price,
            "session_id": item.session_id,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update food item: {str(e)}",
        )


@app.delete("/food-items/{item_id}")
def delete_food_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    item = (
        db.query(models.FoodItem)
        .filter(models.FoodItem.id == item_id)
        .first()
    )

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Food item not found",
        )

    try:
        db.delete(item)
        db.commit()
        return {"message": "Food item deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete food item: {str(e)}",
        )


# ============================================================
# DECOR SESSIONS
# ============================================================

@app.post("/decor-sessions")
def create_decor_session(
    payload: dict,
    db: Session = Depends(get_db),
):
    name = str(payload.get("name", "")).strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Decor session name is required",
        )

    session = models.DecorSession(name=name)

    try:
        db.add(session)
        db.commit()
        db.refresh(session)

        return {
            "id": session.id,
            "name": session.name,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create decor session: {str(e)}",
        )


@app.get("/decor-sessions")
def get_decor_sessions(db: Session = Depends(get_db)):
    try:
        sessions = db.query(models.DecorSession).all()

        return [
            {
                "id": item.id,
                "name": item.name,
            }
            for item in sessions
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get decor sessions: {str(e)}",
        )


@app.put("/decor-sessions/{session_id}")
def update_decor_session(
    session_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.DecorSession)
        .filter(models.DecorSession.id == session_id)
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Decor session not found",
        )

    try:
        if "name" in payload:
            session.name = str(payload["name"]).strip()

        db.commit()
        db.refresh(session)

        return {
            "id": session.id,
            "name": session.name,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update decor session: {str(e)}",
        )


@app.delete("/decor-sessions/{session_id}")
def delete_decor_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    session = (
        db.query(models.DecorSession)
        .filter(models.DecorSession.id == session_id)
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Decor session not found",
        )

    try:
        db.delete(session)
        db.commit()
        return {"message": "Decor session deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete decor session: {str(e)}",
        )


# ============================================================
# DECOR ITEMS
# ============================================================

@app.post("/decor-items")
def create_decor_item(
    payload: dict,
    db: Session = Depends(get_db),
):
    try:
        item = models.DecorItem(**payload)
        db.add(item)
        db.commit()
        db.refresh(item)

        return {
            column.name: getattr(item, column.name)
            for column in item.__table__.columns
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create decor item: {str(e)}",
        )


@app.get("/decor-items")
def get_decor_items(db: Session = Depends(get_db)):
    try:
        items = db.query(models.DecorItem).all()

        return [
            {
                column.name: getattr(item, column.name)
                for column in item.__table__.columns
            }
            for item in items
        ]

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get decor items: {str(e)}",
        )


@app.put("/decor-items/{item_id}")
def update_decor_item(
    item_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    item = (
        db.query(models.DecorItem)
        .filter(models.DecorItem.id == item_id)
        .first()
    )

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Decor item not found",
        )

    try:
        valid_fields = {
            column.name for column in item.__table__.columns
        }

        for field, value in payload.items():
            if field in valid_fields and field != "id":
                setattr(item, field, value)

        db.commit()
        db.refresh(item)

        return {
            column.name: getattr(item, column.name)
            for column in item.__table__.columns
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update decor item: {str(e)}",
        )


@app.delete("/decor-items/{item_id}")
def delete_decor_item(
    item_id: int,
    db: Session = Depends(get_db),
):
    item = (
        db.query(models.DecorItem)
        .filter(models.DecorItem.id == item_id)
        .first()
    )

    if item is None:
        raise HTTPException(
            status_code=404,
            detail="Decor item not found",
        )

    try:
        db.delete(item)
        db.commit()
        return {"message": "Decor item deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete decor item: {str(e)}",
        )


# ============================================================
# KITCHEN STAFF & WAGES API
# ============================================================

@app.get("/kitchen/summary", response_model=schemas.KitchenSummaryResponse)
def get_kitchen_summary(db: Session = Depends(get_db)):
    total_staff = db.query(models.KitchenStaff).count()
    active_staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.status == "active").count()
    monthly_staff_count = db.query(models.KitchenStaff).filter(
        models.KitchenStaff.status == "active",
        models.KitchenStaff.wage_type == "monthly"
    ).count()
    daily_staff_count = db.query(models.KitchenStaff).filter(
        models.KitchenStaff.status == "active",
        models.KitchenStaff.wage_type == "daily"
    ).count()

    total_wage_records = db.query(func.coalesce(func.sum(models.KitchenWage.total_wage), 0)).scalar()
    total_duty_records = db.query(func.coalesce(func.sum(models.KitchenDuty.total_wage), 0)).scalar()
    total_wages = Decimal(str(total_wage_records)) + Decimal(str(total_duty_records))

    total_paid = db.query(func.coalesce(func.sum(models.KitchenPayment.amount), 0)).scalar()
    pending_balance = max(Decimal("0.00"), total_wages - Decimal(str(total_paid)))

    today = DateType.today()
    today_duties_count = db.query(models.KitchenDuty).filter(
        models.KitchenDuty.duty_date == today,
        models.KitchenDuty.duty_units > 0
    ).count()
    today_duty_wages = db.query(func.coalesce(func.sum(models.KitchenDuty.total_wage), 0)).filter(
        models.KitchenDuty.duty_date == today
    ).scalar()

    return {
        "total_staff": total_staff,
        "active_staff": active_staff,
        "monthly_staff_count": monthly_staff_count,
        "daily_staff_count": daily_staff_count,
        "total_wages": total_wages,
        "total_paid": Decimal(str(total_paid)),
        "total_pending_balance": pending_balance,
        "today_duties_count": today_duties_count,
        "today_duty_wages": Decimal(str(today_duty_wages)),
    }


@app.get("/kitchen/staff", response_model=list[schemas.KitchenStaffResponse])
def get_kitchen_staff(status: Optional[str] = None, wage_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.KitchenStaff)
    if status:
        query = query.filter(models.KitchenStaff.status == status)
    if wage_type:
        query = query.filter(models.KitchenStaff.wage_type == wage_type)

    staff_list = query.order_by(models.KitchenStaff.name.asc()).all()
    results = []

    for s in staff_list:
        wages_sum = db.query(func.coalesce(func.sum(models.KitchenWage.total_wage), 0)).filter(
            models.KitchenWage.staff_id == s.id
        ).scalar()
        duty_wages_sum = db.query(func.coalesce(func.sum(models.KitchenDuty.total_wage), 0)).filter(
            models.KitchenDuty.staff_id == s.id
        ).scalar()
        duties_count = db.query(models.KitchenDuty).filter(
            models.KitchenDuty.staff_id == s.id,
            models.KitchenDuty.duty_units > 0
        ).count()
        payments_sum = db.query(func.coalesce(func.sum(models.KitchenPayment.amount), 0)).filter(
            models.KitchenPayment.staff_id == s.id
        ).scalar()

        total_w = Decimal(str(wages_sum)) + Decimal(str(duty_wages_sum))
        total_p = Decimal(str(payments_sum))
        bal = total_w - total_p

        results.append({
            "id": s.id,
            "name": s.name,
            "mobile": s.mobile,
            "kitchen_role": s.kitchen_role,
            "wage_type": s.wage_type,
            "wage_rate": s.wage_rate,
            "status": s.status,
            "joined_date": s.joined_date,
            "address": s.address,
            "notes": s.notes,
            "duties_count": duties_count,
            "total_wages": total_w,
            "total_paid": total_p,
            "balance": bal,
        })
    return results


@app.post("/kitchen/staff", response_model=schemas.KitchenStaffResponse)
def create_kitchen_staff(payload: schemas.KitchenStaffCreate, db: Session = Depends(get_db)):
    staff = models.KitchenStaff(
        name=payload.name.strip(),
        mobile=payload.mobile.strip() if payload.mobile else None,
        kitchen_role=payload.kitchen_role.strip(),
        wage_type=payload.wage_type.lower(),
        wage_rate=payload.wage_rate,
        status=payload.status.lower(),
        joined_date=payload.joined_date or DateType.today(),
        address=payload.address.strip() if payload.address else None,
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return {
        "id": staff.id,
        "name": staff.name,
        "mobile": staff.mobile,
        "kitchen_role": staff.kitchen_role,
        "wage_type": staff.wage_type,
        "wage_rate": staff.wage_rate,
        "status": staff.status,
        "joined_date": staff.joined_date,
        "address": staff.address,
        "notes": staff.notes,
        "duties_count": 0,
        "total_wages": Decimal("0.00"),
        "total_paid": Decimal("0.00"),
        "balance": Decimal("0.00"),
    }


@app.get("/kitchen/staff/{staff_id}", response_model=schemas.KitchenStaffResponse)
def get_kitchen_staff_detail(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Kitchen staff not found")

    wages_sum = db.query(func.coalesce(func.sum(models.KitchenWage.total_wage), 0)).filter(
        models.KitchenWage.staff_id == staff.id
    ).scalar()
    duty_wages_sum = db.query(func.coalesce(func.sum(models.KitchenDuty.total_wage), 0)).filter(
        models.KitchenDuty.staff_id == staff.id
    ).scalar()
    duties_count = db.query(models.KitchenDuty).filter(
        models.KitchenDuty.staff_id == staff.id,
        models.KitchenDuty.duty_units > 0
    ).count()
    payments_sum = db.query(func.coalesce(func.sum(models.KitchenPayment.amount), 0)).filter(
        models.KitchenPayment.staff_id == staff.id
    ).scalar()

    total_w = Decimal(str(wages_sum)) + Decimal(str(duty_wages_sum))
    total_p = Decimal(str(payments_sum))
    bal = total_w - total_p

    return {
        "id": staff.id,
        "name": staff.name,
        "mobile": staff.mobile,
        "kitchen_role": staff.kitchen_role,
        "wage_type": staff.wage_type,
        "wage_rate": staff.wage_rate,
        "status": staff.status,
        "joined_date": staff.joined_date,
        "address": staff.address,
        "notes": staff.notes,
        "duties_count": duties_count,
        "total_wages": total_w,
        "total_paid": total_p,
        "balance": bal,
    }


@app.put("/kitchen/staff/{staff_id}", response_model=schemas.KitchenStaffResponse)
def update_kitchen_staff(staff_id: int, payload: schemas.KitchenStaffUpdate, db: Session = Depends(get_db)):
    staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Kitchen staff not found")

    if payload.name is not None:
        staff.name = payload.name.strip()
    if payload.mobile is not None:
        staff.mobile = payload.mobile.strip() if payload.mobile else None
    if payload.kitchen_role is not None:
        staff.kitchen_role = payload.kitchen_role.strip()
    if payload.wage_type is not None:
        staff.wage_type = payload.wage_type.lower()
    if payload.wage_rate is not None:
        staff.wage_rate = payload.wage_rate
    if payload.status is not None:
        staff.status = payload.status.lower()
    if payload.joined_date is not None:
        staff.joined_date = payload.joined_date
    if payload.address is not None:
        staff.address = payload.address.strip() if payload.address else None
    if payload.notes is not None:
        staff.notes = payload.notes.strip() if payload.notes else None

    db.commit()
    db.refresh(staff)

    wages_sum = db.query(func.coalesce(func.sum(models.KitchenWage.total_wage), 0)).filter(
        models.KitchenWage.staff_id == staff.id
    ).scalar()
    duty_wages_sum = db.query(func.coalesce(func.sum(models.KitchenDuty.total_wage), 0)).filter(
        models.KitchenDuty.staff_id == staff.id
    ).scalar()
    duties_count = db.query(models.KitchenDuty).filter(
        models.KitchenDuty.staff_id == staff.id,
        models.KitchenDuty.duty_units > 0
    ).count()
    payments_sum = db.query(func.coalesce(func.sum(models.KitchenPayment.amount), 0)).filter(
        models.KitchenPayment.staff_id == staff.id
    ).scalar()

    total_w = Decimal(str(wages_sum)) + Decimal(str(duty_wages_sum))
    total_p = Decimal(str(payments_sum))
    bal = total_w - total_p

    return {
        "id": staff.id,
        "name": staff.name,
        "mobile": staff.mobile,
        "kitchen_role": staff.kitchen_role,
        "wage_type": staff.wage_type,
        "wage_rate": staff.wage_rate,
        "status": staff.status,
        "joined_date": staff.joined_date,
        "address": staff.address,
        "notes": staff.notes,
        "duties_count": duties_count,
        "total_wages": total_w,
        "total_paid": total_p,
        "balance": bal,
    }


@app.delete("/kitchen/staff/{staff_id}")
def delete_kitchen_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Kitchen staff not found")

    db.query(models.KitchenDuty).filter(models.KitchenDuty.staff_id == staff_id).delete()
    db.query(models.KitchenWage).filter(models.KitchenWage.staff_id == staff_id).delete()
    db.query(models.KitchenPayment).filter(models.KitchenPayment.staff_id == staff_id).delete()
    db.delete(staff)
    db.commit()
    return {"message": "Kitchen staff and related records deleted successfully"}


# ============================================================
# WAGE CALCULATION & WAGE RECORDS
# ============================================================

@app.post("/kitchen/wages", response_model=schemas.KitchenWageResponse)
def create_kitchen_wage(payload: schemas.KitchenWageCreate, db: Session = Depends(get_db)):
    staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.id == payload.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Kitchen staff not found")

    base_rate = payload.base_rate if payload.base_rate is not None else staff.wage_rate
    wage_type = payload.wage_type or staff.wage_type
    days_worked = payload.days_worked

    if wage_type == "daily":
        calc_wage = base_rate * days_worked
    else:
        if days_worked >= 30:
            calc_wage = base_rate
        else:
            calc_wage = round((base_rate / Decimal(30)) * days_worked, 2)

    total_w = calc_wage + payload.bonus - payload.deduction

    wage_record = models.KitchenWage(
        staff_id=staff.id,
        period=payload.period.strip(),
        wage_type=wage_type,
        days_worked=days_worked,
        base_rate=base_rate,
        calculated_wage=calc_wage,
        bonus=payload.bonus,
        deduction=payload.deduction,
        total_wage=total_w,
        date_recorded=payload.date_recorded or DateType.today(),
        notes=payload.notes.strip() if payload.notes else None,
    )
    db.add(wage_record)
    db.commit()
    db.refresh(wage_record)

    return {
        "id": wage_record.id,
        "staff_id": wage_record.staff_id,
        "staff_name": staff.name,
        "period": wage_record.period,
        "wage_type": wage_record.wage_type,
        "days_worked": wage_record.days_worked,
        "base_rate": wage_record.base_rate,
        "calculated_wage": wage_record.calculated_wage,
        "bonus": wage_record.bonus,
        "deduction": wage_record.deduction,
        "total_wage": wage_record.total_wage,
        "date_recorded": wage_record.date_recorded,
        "notes": wage_record.notes,
    }


@app.post("/kitchen/wages/auto-set")
def auto_set_kitchen_wages(payload: schemas.KitchenAutoWageRequest, db: Session = Depends(get_db)):
    query = db.query(models.KitchenStaff).filter(models.KitchenStaff.status == "active")
    if payload.staff_ids and len(payload.staff_ids) > 0:
        query = query.filter(models.KitchenStaff.id.in_(payload.staff_ids))

    staff_members = query.all()
    if not staff_members:
        raise HTTPException(status_code=400, detail="No active kitchen staff found to set wages")

    created_wages = []
    record_date = payload.date_recorded or DateType.today()

    for s in staff_members:
        days = payload.days_worked
        if s.wage_type == "daily":
            calc_wage = s.wage_rate * days
        else:
            if days >= 30:
                calc_wage = s.wage_rate
            else:
                calc_wage = round((s.wage_rate / Decimal(30)) * days, 2)

        wage_entry = models.KitchenWage(
            staff_id=s.id,
            period=payload.period.strip(),
            wage_type=s.wage_type,
            days_worked=days,
            base_rate=s.wage_rate,
            calculated_wage=calc_wage,
            bonus=Decimal("0.00"),
            deduction=Decimal("0.00"),
            total_wage=calc_wage,
            date_recorded=record_date,
            notes=f"Auto-generated wage for period {payload.period.strip()}",
        )
        db.add(wage_entry)
        created_wages.append(wage_entry)

    db.commit()
    return {
        "message": f"Successfully auto-generated wages for {len(created_wages)} staff members",
        "count": len(created_wages),
        "period": payload.period,
    }


@app.get("/kitchen/wages", response_model=list[schemas.KitchenWageResponse])
def get_kitchen_wages(staff_id: Optional[int] = None, period: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.KitchenWage, models.KitchenStaff.name.label("staff_name")).join(
        models.KitchenStaff, models.KitchenWage.staff_id == models.KitchenStaff.id
    )
    if staff_id:
        query = query.filter(models.KitchenWage.staff_id == staff_id)
    if period:
        query = query.filter(models.KitchenWage.period == period)

    rows = query.order_by(models.KitchenWage.date_recorded.desc(), models.KitchenWage.id.desc()).all()
    results = []
    for wage, s_name in rows:
        results.append({
            "id": wage.id,
            "staff_id": wage.staff_id,
            "staff_name": s_name,
            "period": wage.period,
            "wage_type": wage.wage_type,
            "days_worked": wage.days_worked,
            "base_rate": wage.base_rate,
            "calculated_wage": wage.calculated_wage,
            "bonus": wage.bonus,
            "deduction": wage.deduction,
            "total_wage": wage.total_wage,
            "date_recorded": wage.date_recorded,
            "notes": wage.notes,
        })
    return results


@app.delete("/kitchen/wages/{wage_id}")
def delete_kitchen_wage(wage_id: int, db: Session = Depends(get_db)):
    wage = db.query(models.KitchenWage).filter(models.KitchenWage.id == wage_id).first()
    if not wage:
        raise HTTPException(status_code=404, detail="Wage record not found")
    db.delete(wage)
    db.commit()
    return {"message": "Wage record deleted successfully"}


# ============================================================
# KITCHEN STAFF PAYMENTS
# ============================================================

@app.post("/kitchen/payments", response_model=schemas.KitchenPaymentResponse)
def create_kitchen_payment(payload: schemas.KitchenPaymentCreate, db: Session = Depends(get_db)):
    staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.id == payload.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Kitchen staff not found")

    payment = models.KitchenPayment(
        staff_id=payload.staff_id,
        amount=payload.amount,
        payment_date=payload.payment_date or DateType.today(),
        payment_mode=payload.payment_mode or "Cash",
        reference_no=payload.reference_no.strip() if payload.reference_no else None,
        note=payload.note.strip() if payload.note else None,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return {
        "id": payment.id,
        "staff_id": payment.staff_id,
        "staff_name": staff.name,
        "amount": payment.amount,
        "payment_date": payment.payment_date,
        "payment_mode": payment.payment_mode,
        "reference_no": payment.reference_no,
        "note": payment.note,
    }


@app.get("/kitchen/payments", response_model=list[schemas.KitchenPaymentResponse])
def get_kitchen_payments(staff_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.KitchenPayment, models.KitchenStaff.name.label("staff_name")).join(
        models.KitchenStaff, models.KitchenPayment.staff_id == models.KitchenStaff.id
    )
    if staff_id:
        query = query.filter(models.KitchenPayment.staff_id == staff_id)

    rows = query.order_by(models.KitchenPayment.payment_date.desc(), models.KitchenPayment.id.desc()).all()
    results = []
    for pay, s_name in rows:
        results.append({
            "id": pay.id,
            "staff_id": pay.staff_id,
            "staff_name": s_name,
            "amount": pay.amount,
            "payment_date": pay.payment_date,
            "payment_mode": pay.payment_mode,
            "reference_no": pay.reference_no,
            "note": pay.note,
        })
    return results


@app.delete("/kitchen/payments/{payment_id}")
def delete_kitchen_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(models.KitchenPayment).filter(models.KitchenPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Kitchen payment not found")
    db.delete(payment)
    db.commit()
    return {"message": "Payment record deleted successfully"}


# ============================================================
# KITCHEN DAILY DUTIES & CORRESPONDING WAGES
# ============================================================

@app.get("/kitchen/duties", response_model=list[schemas.KitchenDutyResponse])
def get_kitchen_duties(
    duty_date: Optional[DateType] = None,
    staff_id: Optional[int] = None,
    start_date: Optional[DateType] = None,
    end_date: Optional[DateType] = None,
    db: Session = Depends(get_db)
):
    query = db.query(
        models.KitchenDuty,
        models.KitchenStaff.name.label("staff_name"),
        models.KitchenStaff.kitchen_role.label("kitchen_role"),
        models.KitchenStaff.wage_type.label("wage_type"),
    ).join(models.KitchenStaff, models.KitchenDuty.staff_id == models.KitchenStaff.id)

    if duty_date:
        query = query.filter(models.KitchenDuty.duty_date == duty_date)
    if staff_id:
        query = query.filter(models.KitchenDuty.staff_id == staff_id)
    if start_date:
        query = query.filter(models.KitchenDuty.duty_date >= start_date)
    if end_date:
        query = query.filter(models.KitchenDuty.duty_date <= end_date)

    rows = query.order_by(models.KitchenDuty.duty_date.desc(), models.KitchenDuty.id.desc()).all()

    # Preload payments and duties for relevant staff to automatically resolve payment status
    staff_ids = list({d.staff_id for d, _, _, _ in rows})
    payments_by_staff = {sid: [] for sid in staff_ids}
    if staff_ids:
        all_payments = db.query(models.KitchenPayment).filter(
            models.KitchenPayment.staff_id.in_(staff_ids)
        ).order_by(models.KitchenPayment.payment_date.asc(), models.KitchenPayment.id.asc()).all()
        for p in all_payments:
            payments_by_staff[p.staff_id].append(p)

    all_duties_asc = {sid: [] for sid in staff_ids}
    if staff_ids:
        all_duties = db.query(models.KitchenDuty).filter(
            models.KitchenDuty.staff_id.in_(staff_ids)
        ).order_by(models.KitchenDuty.duty_date.asc(), models.KitchenDuty.id.asc()).all()
        for dt in all_duties:
            all_duties_asc[dt.staff_id].append(dt)

    duty_coverage = {}
    for sid in staff_ids:
        p_list = payments_by_staff.get(sid, [])
        d_list = all_duties_asc.get(sid, [])

        total_paid = sum((p.amount for p in p_list), Decimal('0.00'))
        total_wages = sum((dt.total_wage for dt in d_list), Decimal('0.00'))

        # If staff has 0 or negative balance, all work days are 100% paid
        is_fully_settled = (total_paid >= total_wages and total_wages > 0)

        payments_by_date = {}
        for p in p_list:
            payments_by_date[p.payment_date] = p

        remaining_pool = total_paid

        for dt in d_list:
            wage = dt.total_wage or Decimal('0.00')

            if wage <= 0:
                duty_coverage[dt.id] = {
                    'paid_today': False,
                    'paid_amount': Decimal('0.00'),
                    'payment_mode': '—',
                    'payment_status': 'free',
                }
                continue

            if is_fully_settled:
                last_mode = p_list[-1].payment_mode if p_list else 'Cash'
                duty_coverage[dt.id] = {
                    'paid_today': True,
                    'paid_amount': wage,
                    'payment_mode': last_mode,
                    'payment_status': 'paid',
                }
                continue

            if remaining_pool >= wage:
                remaining_pool -= wage
                first_mode = p_list[0].payment_mode if p_list else 'Cash'
                duty_coverage[dt.id] = {
                    'paid_today': True,
                    'paid_amount': wage,
                    'payment_mode': first_mode,
                    'payment_status': 'paid',
                }
            elif remaining_pool > 0:
                part_amt = remaining_pool
                remaining_pool = Decimal('0.00')
                duty_coverage[dt.id] = {
                    'paid_today': False,
                    'paid_amount': part_amt,
                    'payment_mode': 'Cash',
                    'payment_status': 'partial',
                }
            else:
                duty_coverage[dt.id] = {
                    'paid_today': False,
                    'paid_amount': Decimal('0.00'),
                    'payment_mode': 'Cash',
                    'payment_status': 'pending',
                }

    results = []
    for d, s_name, k_role, w_type in rows:
        cov = duty_coverage.get(d.id, {
            'paid_today': False,
            'paid_amount': Decimal('0.00'),
            'payment_mode': 'Cash',
            'payment_status': 'pending',
        })

        results.append({
            'id': d.id,
            'staff_id': d.staff_id,
            'staff_name': s_name,
            'kitchen_role': k_role,
            'wage_type': w_type,
            'duty_date': d.duty_date,
            'shift': d.shift,
            'duty_status': d.duty_status,
            'duty_units': d.duty_units,
            'daily_rate': d.daily_rate,
            'duty_wage': d.duty_wage,
            'bonus': d.bonus,
            'deduction': d.deduction,
            'total_wage': d.total_wage,
            'today_wage': d.total_wage,
            'paid_today': cov['paid_today'],
            'paid_amount': cov['paid_amount'],
            'payment_mode': cov['payment_mode'],
            'note': d.note,
        })
    return results


@app.post("/kitchen/duties", response_model=schemas.KitchenDutyResponse)
def create_or_update_kitchen_duty(payload: schemas.KitchenDutyCreate, db: Session = Depends(get_db)):
    staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.id == payload.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Kitchen staff not found")

    duty_date = payload.duty_date or DateType.today()

    if payload.duty_status.lower() in ("absent", "off"):
        units = Decimal("0.00")
    elif payload.duty_status.lower() in ("half", "half day"):
        units = Decimal("0.50")
    else:
        units = payload.duty_units if payload.duty_units is not None else Decimal("1.00")

    if staff.wage_type == "monthly":
        if payload.today_wage is not None and payload.duty_status.lower() not in ("absent", "off"):
            rate = payload.today_wage
            duty_wage = payload.today_wage
        else:
            rate = Decimal("0.00")
            duty_wage = Decimal("0.00")
        total_w = max(Decimal("0.00"), duty_wage + payload.bonus - payload.deduction)
    else:
        if payload.duty_status.lower() in ("absent", "off"):
            rate = Decimal("0.00")
            duty_wage = Decimal("0.00")
            total_w = Decimal("0.00")
        elif payload.today_wage is not None:
            rate = payload.today_wage
            duty_wage = payload.today_wage
            total_w = max(Decimal("0.00"), duty_wage + payload.bonus - payload.deduction)
        else:
            rate = payload.daily_rate if payload.daily_rate is not None else staff.wage_rate
            duty_wage = rate * units
            total_w = max(Decimal("0.00"), duty_wage + payload.bonus - payload.deduction)

    existing = db.query(models.KitchenDuty).filter(
        models.KitchenDuty.staff_id == staff.id,
        models.KitchenDuty.duty_date == duty_date,
    ).first()

    if existing:
        existing.shift = payload.shift
        existing.duty_status = payload.duty_status
        existing.duty_units = units
        existing.daily_rate = rate
        existing.duty_wage = duty_wage
        existing.bonus = payload.bonus
        existing.deduction = payload.deduction
        existing.total_wage = total_w
        existing.note = payload.note.strip() if payload.note else None
        db.commit()
        db.refresh(existing)
        duty_obj = existing
    else:
        duty_obj = models.KitchenDuty(
            staff_id=staff.id,
            duty_date=duty_date,
            shift=payload.shift,
            duty_status=payload.duty_status,
            duty_units=units,
            daily_rate=rate,
            duty_wage=duty_wage,
            bonus=payload.bonus,
            deduction=payload.deduction,
            total_wage=total_w,
            note=payload.note.strip() if payload.note else None,
        )
        db.add(duty_obj)
        db.commit()
        db.refresh(duty_obj)

    existing_payment = db.query(models.KitchenPayment).filter(
        models.KitchenPayment.staff_id == staff.id,
        models.KitchenPayment.payment_date == duty_date,
        models.KitchenPayment.note.ilike(f"%Daily wage for {duty_date}%")
    ).first()

    if payload.paid_today or (payload.paid_amount and payload.paid_amount > 0):
        pay_amt = payload.paid_amount if (payload.paid_amount and payload.paid_amount > 0) else total_w
        if pay_amt > 0:
            if existing_payment:
                existing_payment.amount = pay_amt
                existing_payment.payment_mode = payload.payment_mode or "Cash"
            else:
                db.add(models.KitchenPayment(
                    staff_id=staff.id,
                    amount=pay_amt,
                    payment_date=duty_date,
                    payment_mode=payload.payment_mode or "Cash",
                    note=f"Daily wage for {duty_date}",
                ))
            db.commit()
    else:
        if existing_payment:
            db.delete(existing_payment)
            db.commit()

    return {
        "id": duty_obj.id,
        "staff_id": duty_obj.staff_id,
        "staff_name": staff.name,
        "kitchen_role": staff.kitchen_role,
        "wage_type": staff.wage_type,
        "duty_date": duty_obj.duty_date,
        "shift": duty_obj.shift,
        "duty_status": duty_obj.duty_status,
        "duty_units": duty_obj.duty_units,
        "daily_rate": duty_obj.daily_rate,
        "duty_wage": duty_obj.duty_wage,
        "bonus": duty_obj.bonus,
        "deduction": duty_obj.deduction,
        "total_wage": duty_obj.total_wage,
        "today_wage": duty_obj.total_wage,
        "paid_today": payload.paid_today,
        "paid_amount": payload.paid_amount or Decimal("0.00"),
        "payment_mode": payload.payment_mode or "Cash",
        "note": duty_obj.note,
    }


@app.post("/kitchen/duties/batch")
def save_batch_kitchen_duties(payload: schemas.KitchenBatchDutyRequest, db: Session = Depends(get_db)):
    duty_date = payload.duty_date
    saved_count = 0

    for item in payload.duties:
        staff = db.query(models.KitchenStaff).filter(models.KitchenStaff.id == item.staff_id).first()
        if not staff:
            continue

        if item.duty_status.lower() in ("absent", "off"):
            units = Decimal("0.00")
        elif item.duty_status.lower() in ("half", "half day"):
            units = Decimal("0.50")
        else:
            units = item.duty_units if item.duty_units is not None else Decimal("1.00")

        if staff.wage_type == "monthly":
            if item.today_wage is not None and item.duty_status.lower() not in ("absent", "off"):
                rate = item.today_wage
                duty_wage = item.today_wage
            else:
                rate = Decimal("0.00")
                duty_wage = Decimal("0.00")
            total_w = max(Decimal("0.00"), duty_wage + item.bonus - item.deduction)
        else:
            if item.duty_status.lower() in ("absent", "off"):
                rate = Decimal("0.00")
                duty_wage = Decimal("0.00")
                total_w = Decimal("0.00")
            elif item.today_wage is not None:
                rate = item.today_wage
                duty_wage = item.today_wage
                total_w = max(Decimal("0.00"), duty_wage + item.bonus - item.deduction)
            else:
                rate = item.daily_rate if item.daily_rate is not None else staff.wage_rate
                duty_wage = rate * units
                total_w = max(Decimal("0.00"), duty_wage + item.bonus - item.deduction)

        existing = db.query(models.KitchenDuty).filter(
            models.KitchenDuty.staff_id == staff.id,
            models.KitchenDuty.duty_date == duty_date,
        ).first()

        if existing:
            existing.shift = item.shift
            existing.duty_status = item.duty_status
            existing.duty_units = units
            existing.daily_rate = rate
            existing.duty_wage = duty_wage
            existing.bonus = item.bonus
            existing.deduction = item.deduction
            existing.total_wage = total_w
            existing.note = item.note.strip() if item.note else None
        else:
            new_duty = models.KitchenDuty(
                staff_id=staff.id,
                duty_date=duty_date,
                shift=item.shift,
                duty_status=item.duty_status,
                duty_units=units,
                daily_rate=rate,
                duty_wage=duty_wage,
                bonus=item.bonus,
                deduction=item.deduction,
                total_wage=total_w,
                note=item.note.strip() if item.note else None,
            )
            db.add(new_duty)

        existing_payment = db.query(models.KitchenPayment).filter(
            models.KitchenPayment.staff_id == staff.id,
            models.KitchenPayment.payment_date == duty_date,
            models.KitchenPayment.note.ilike(f"%Daily wage for {duty_date}%")
        ).first()

        if item.paid_today or (item.paid_amount and item.paid_amount > 0):
            pay_amt = item.paid_amount if (item.paid_amount and item.paid_amount > 0) else total_w
            if pay_amt > 0:
                if existing_payment:
                    existing_payment.amount = pay_amt
                    existing_payment.payment_mode = item.payment_mode or "Cash"
                else:
                    db.add(models.KitchenPayment(
                        staff_id=staff.id,
                        amount=pay_amt,
                        payment_date=duty_date,
                        payment_mode=item.payment_mode or "Cash",
                        note=f"Daily wage for {duty_date}",
                    ))
        else:
            if existing_payment:
                db.delete(existing_payment)

        saved_count += 1

    db.commit()
    return {
        "message": f"Successfully saved daily wages for {saved_count} staff members",
        "count": saved_count,
        "date": str(duty_date),
    }


@app.delete("/kitchen/duties/{duty_id}")
def delete_kitchen_duty(duty_id: int, db: Session = Depends(get_db)):
    duty = db.query(models.KitchenDuty).filter(models.KitchenDuty.id == duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail="Duty record not found")
    db.delete(duty)
    db.commit()
    return {"message": "Duty record deleted successfully"}




# ============================================================
# PERMANENT BACKUP DRIVE PATH MANAGEMENT
# ============================================================

class SavePermanentBackupRequest(BaseModel):
    target_dir: str
    file_name: Optional[str] = None
    file_base64: str

class OpenFolderRequest(BaseModel):
    folder_path: str

@app.get("/backup/permanent-path-info")
def get_permanent_path_info(target_dir: str):
    """
    Validates a permanent backup directory path, verifies read/write permissions,
    and returns recent backup files found in this folder.
    """
    clean_dir = os.path.abspath(target_dir.strip())
    exists = os.path.exists(clean_dir)
    writable = False
    files = []

    if exists:
        try:
            test_file = os.path.join(clean_dir, ".test_write_perm")
            with open(test_file, "w") as f:
                f.write("ok")
            os.remove(test_file)
            writable = True

            for fname in os.listdir(clean_dir):
                if fname.endswith(".xlsx") or fname.endswith(".json"):
                    fpath = os.path.join(clean_dir, fname)
                    stat = os.stat(fpath)
                    files.append({
                        "name": fname,
                        "path": fpath,
                        "size_bytes": stat.st_size,
                        "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
            files.sort(key=lambda x: x["modified_at"], reverse=True)
        except Exception:
            writable = False
    else:
        parent = os.path.dirname(clean_dir)
        writable = os.path.exists(parent) and os.access(parent, os.W_OK)

    return {
        "target_dir": clean_dir,
        "exists": exists,
        "writable": writable,
        "backups_found": files[:15],
        "total_backups": len(files)
    }

@app.post("/backup/save-to-permanent-path")
def save_to_permanent_path(req: SavePermanentBackupRequest):
    """
    Saves an Excel or JSON backup file directly into the user's permanent drive folder.
    Creates directory if it does not already exist.
    """
    clean_dir = os.path.abspath(req.target_dir.strip())
    os.makedirs(clean_dir, exist_ok=True)

    file_name = req.file_name or f"FoodCourt_Complete_Database_Backup_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.xlsx"
    clean_file_name = "".join(c for c in file_name if c.isalnum() or c in ("-", "_", "."))
    target_file_path = os.path.join(clean_dir, clean_file_name)

    try:
        decoded_bytes = base64.b64decode(req.file_base64)
        with open(target_file_path, "wb") as f:
            f.write(decoded_bytes)
        
        stat = os.stat(target_file_path)
        return {
            "success": True,
            "file_name": clean_file_name,
            "file_path": target_file_path,
            "size_bytes": stat.st_size,
            "saved_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write backup file to disk: {str(e)}")

@app.post("/backup/open-folder")
def open_backup_folder(req: OpenFolderRequest):
    """
    Opens the target folder in Windows File Explorer.
    """
    clean_dir = os.path.abspath(req.folder_path.strip())
    if not os.path.exists(clean_dir):
        os.makedirs(clean_dir, exist_ok=True)

    try:
        if os.name == "nt":
            os.startfile(clean_dir)
        else:
            subprocess.Popen(["xdg-open", clean_dir])
        return {"success": True, "message": f"Opened folder: {clean_dir}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")

@app.get("/backup/suggested-paths")
def get_suggested_paths():
    """
    Scans the system for typical backup drives and Google Drive desktop folders.
    """
    suggestions = []
    user_home = os.path.expanduser("~")

    for drive_letter in ["G", "H", "F"]:
        g_drive = f"{drive_letter}:\\My Drive"
        if os.path.exists(g_drive):
            suggestions.append({
                "label": f"Google Drive for Desktop ({drive_letter}:)",
                "path": f"{drive_letter}:\\My Drive\\Food Court Backups",
                "exists": True
            })

    user_gdrive = os.path.join(user_home, "Google Drive")
    if os.path.exists(user_gdrive):
        suggestions.append({
            "label": "Google Drive Folder in User Profile",
            "path": os.path.join(user_gdrive, "Food Court Backups"),
            "exists": True
        })

    if os.path.exists("D:\\"):
        suggestions.append({
            "label": "Dedicated D: Drive",
            "path": "D:\\FoodCourt_Backups",
            "exists": os.path.exists("D:\\FoodCourt_Backups")
        })

    docs_path = os.path.join(user_home, "Documents", "FoodCourt_Backups")
    suggestions.append({
        "label": "Documents Folder",
        "path": docs_path,
        "exists": os.path.exists(docs_path)
    })

    return {"suggestions": suggestions}
