from datetime import date
from sqlalchemy.orm import Session

from app import models
from app import schemas


# ============================================================
# CREATE COMPLETE EVENT
# Customer + Event + Food + Decor + Equipment
# ============================================================

def create_complete_event(
    db: Session,
    data: schemas.CreateEventRequest
):

    try:

        # ====================================================
        # 1. CREATE CUSTOMER
        # ====================================================

        customer = models.Customer(
            name=data.customer.name,
            mobile=data.customer.mobile
        )

        db.add(customer)

        # Generate customer ID
        db.flush()


        # ====================================================
        # 2. CREATE EVENT
        # ====================================================

        event = models.Event(
            customer_id=customer.id,

            date=data.event_date,

            place=data.venue,

            event_type=data.event_type,

            guest_count=data.guest_count,

            food_amt=data.food_amount,

            decor_amt=data.decor_amount,

            total_estimate=data.total_amount,

            quote=data.quote_amount
        )

        db.add(event)

        # Generate event ID
        db.flush()


        # ====================================================
        # 3. ADD FOOD ITEMS
        # ====================================================

        for item in data.food_items:

            # Check master food item
            food_item = (
                db.query(models.FoodItem)
                .filter(
                    models.FoodItem.id == item.food_item_id
                )
                .first()
            )

            if not food_item:
                raise ValueError(
                    f"Food item {item.food_item_id} not found"
                )

            event_food = models.EventFoodItem(
                event_id=event.id,

                food_item_id=item.food_item_id,

                qty=item.quantity,

                price=item.price
            )

            db.add(event_food)


        # ====================================================
        # 4. ADD DECORATION ITEMS
        # ====================================================

        for item in data.decor_items:

            # Check master decoration item
            decor_item = (
                db.query(models.DecorItem)
                .filter(
                    models.DecorItem.id == item.decor_item_id
                )
                .first()
            )

            if not decor_item:
                raise ValueError(
                    f"Decor item {item.decor_item_id} not found"
                )

            event_decor = models.EventDecor(
                event_id=event.id,

                decor_id=item.decor_item_id,

                qty=item.quantity,

                price=item.price
            )

            db.add(event_decor)


        # ====================================================
        # 5. ADD EQUIPMENT
        # ====================================================

        for item in data.equipment_items:

            # Check master equipment item
            equipment = (
                db.query(models.Equipment)
                .filter(
                    models.Equipment.id == item.equipment_id
                )
                .first()
            )

            if not equipment:
                raise ValueError(
                    f"Equipment {item.equipment_id} not found"
                )

            event_equipment = models.EventEquipment(
                event_id=event.id,

                equipment_id=item.equipment_id,

                qty=item.quantity,

                note=item.note
            )

            db.add(event_equipment)


        # ====================================================
        # 6. SAVE EVERYTHING
        # ====================================================

        db.commit()

        db.refresh(event)

        return event


    except Exception:

        # Rollback everything if anything fails
        db.rollback()

        raise


# ============================================================
# STAFF ROLES
# Separate Staff Management Module
# ============================================================

def create_staff_role(
    db: Session,
    staff_role
):

    db_staff_role = models.StaffRole(
        role=staff_role.role,
        wage=staff_role.wage
    )

    db.add(db_staff_role)

    db.commit()

    db.refresh(db_staff_role)

    return db_staff_role


def get_staff_roles(db: Session):

    return (
        db.query(models.StaffRole)
        .order_by(models.StaffRole.id)
        .all()
    )


# ============================================================
# STAFF
# Separate Staff Management Module
# ============================================================

def create_staff(
    db: Session,
    staff
):

    db_staff = models.Staff(
        name=staff.name,
        mobile=staff.mobile,
        role_id=staff.role_id
    )

    db.add(db_staff)

    db.commit()

    db.refresh(db_staff)

    return db_staff


def get_staff(db: Session):

    return (
        db.query(models.Staff)
        .order_by(models.Staff.id)
        .all()
    )


# ============================================================
# STAFF PAYMENTS
# Separate Staff Management Module
# ============================================================

def create_staff_payment(
    db: Session,
    payment
):
    payment_date = getattr(payment, "payment_date", None) or date.today()
    db_payment = models.StaffPayment(
        event_id=payment.event_id,
        staff_id=payment.staff_id,
        payment=payment.payment,
        payment_date=payment_date,
        note=payment.note
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


def get_staff_payments(db: Session):

    return (
        db.query(models.StaffPayment)
        .order_by(models.StaffPayment.id)
        .all()
    )


# ============================================================
# SUB TEAMS
# Separate Sub Team Management Module
# ============================================================

def create_sub_team(
    db: Session,
    sub_team
):

    db_sub_team = models.SubTeam(
        event_id=sub_team.event_id,

        name=sub_team.name,

        note=sub_team.note,

        purpose=sub_team.purpose,

        phone=sub_team.phone,

        amount=sub_team.amount
    )

    db.add(db_sub_team)

    db.commit()

    db.refresh(db_sub_team)

    return db_sub_team


def get_sub_teams(db: Session):

    return (
        db.query(models.SubTeam)
        .order_by(models.SubTeam.id)
        .all()
    )


# ============================================================
# EVENT PAYMENTS
# ============================================================

def create_event_payment(
    db: Session,
    payment: schemas.EventPaymentCreate
):
    payment_date = payment.payment_date or date.today()
    db_payment = models.EventPayment(
        event_id=payment.event_id,
        amount=payment.amount,
        payment_method=payment.payment_method or "Cash",
        payment_type=payment.payment_type or "Advance",
        payment_date=payment_date,
        note=payment.note
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


def get_event_payments(db: Session, event_id: int):
    return (
        db.query(models.EventPayment)
        .filter(models.EventPayment.event_id == event_id)
        .order_by(models.EventPayment.payment_date.desc(), models.EventPayment.id.desc())
        .all()
    )


def delete_event_payment(db: Session, payment_id: int):
    payment = (
        db.query(models.EventPayment)
        .filter(models.EventPayment.id == payment_id)
        .first()
    )
    if not payment:
        return None
    db.delete(payment)
    db.commit()
    return payment


def get_all_event_payments(db: Session):
    return (
        db.query(models.EventPayment)
        .order_by(models.EventPayment.payment_date.desc(), models.EventPayment.id.desc())
        .all()
    )


# ============================================================
# EXPENSES
# ============================================================

def create_expense(
    db: Session,
    expense: schemas.ExpenseCreate
):
    expense_date = expense.expense_date or date.today()
    db_expense = models.Expense(
        title=expense.title,
        category=expense.category or "Miscellaneous",
        amount=expense.amount,
        expense_date=expense_date,
        event_id=expense.event_id,
        payment_method=expense.payment_method or "Cash",
        vendor=expense.vendor,
        bill_number=expense.bill_number,
        note=expense.note
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


def get_expenses(
    db: Session,
    event_id: int | None = None,
    category: str | None = None
):
    query = db.query(models.Expense)
    if event_id is not None:
        query = query.filter(models.Expense.event_id == event_id)
    if category is not None and category.strip():
        query = query.filter(models.Expense.category.ilike(f"%{category.strip()}%"))
    return query.order_by(models.Expense.expense_date.desc(), models.Expense.id.desc()).all()


def get_expense(db: Session, expense_id: int):
    return (
        db.query(models.Expense)
        .filter(models.Expense.id == expense_id)
        .first()
    )


def update_expense(
    db: Session,
    expense_id: int,
    payload: schemas.ExpenseUpdate
):
    expense = get_expense(db, expense_id)
    if not expense:
        return None

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(expense, field) and value is not None:
            setattr(expense, field, value)

    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, expense_id: int):
    expense = get_expense(db, expense_id)
    if not expense:
        return None
    db.delete(expense)
    db.commit()
    return expense
