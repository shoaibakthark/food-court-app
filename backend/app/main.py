
from datetime import date as DateType
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
        allowed_prefixes = ["/staff", "/staff-payments", "/staff-roles", "/auth", "/docs", "/openapi.json"]
        if path != "/" and not any(path.startswith(p) for p in allowed_prefixes):
            from starlette.responses import JSONResponse
            return JSONResponse(
                status_code=403,
                content={"detail": "Access restricted: Manager role has access only to Staff and Staff Payments."}
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
        allowed_pages = ["/staff", "/staff-payments"]

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
