from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Numeric,
    ForeignKey
)

from app.database import Base


# ============================================================
# CUSTOMERS
# ============================================================

class Customer(Base):
    __tablename__ = "customers"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(150),
        nullable=False
    )

    mobile = Column(
        String(20),
        nullable=False
    )


# ============================================================
# SESSIONS
# ============================================================

class Session(Base):
    __tablename__ = "sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False,
        unique=True
    )

    price = Column(
        Numeric(12, 2),
        nullable=True
    )


# ============================================================
# FOOD ITEMS MASTER
# ============================================================

class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(150),
        nullable=False
    )

    price = Column(
        Numeric(12, 2),
        nullable=False
    )

    session_id = Column(
        Integer,
        ForeignKey("sessions.id"),
        nullable=False
    )


# ============================================================
# DECORATION SESSIONS / CATEGORIES
# Same concept as FOOD SESSIONS
# ============================================================

class DecorSession(Base):
    __tablename__ = "decor_sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(100),
        nullable=False,
        unique=True
    )

    price = Column(
        Numeric(12, 2),
        nullable=True
    )


# ============================================================
# DECORATION ITEMS MASTER
# Same concept as FOOD ITEMS
# ============================================================

class DecorItem(Base):
    __tablename__ = "decor_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(150),
        nullable=False
    )

    price = Column(
        Numeric(12, 2),
        nullable=False
    )

    session_id = Column(
        Integer,
        ForeignKey("decor_sessions.id"),
        nullable=False
    )


# ============================================================
# EQUIPMENT MASTER
# Used only as a reminder/checklist for programs
# No price because equipment is NOT part of quotation
# ============================================================

class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(150),
        nullable=False
    )

    session_id = Column(
        Integer,
        ForeignKey("sessions.id"),
        nullable=False
    )


# ============================================================
# EVENTS
# ============================================================

class Event(Base):
    __tablename__ = "events"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    customer_id = Column(
        Integer,
        ForeignKey("customers.id"),
        nullable=False
    )

    date = Column(
        Date,
        nullable=False
    )

    place = Column(
        String(150),
        nullable=False
    )

    guest_count = Column(
        Integer,
        nullable=False
    )

    event_type = Column(
        String(100),
        nullable=False
    )

    food_amt = Column(
        Numeric(12, 2),
        default=0
    )

    decor_amt = Column(
        Numeric(12, 2),
        default=0
    )

    total_estimate = Column(
        Numeric(12, 2),
        default=0
    )

    quote = Column(
        Numeric(12, 2),
        nullable=True
    )


# ============================================================
# EVENT FOOD ITEMS
# ============================================================

class EventFoodItem(Base):
    __tablename__ = "event_food_items"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id"),
        nullable=False
    )

    food_item_id = Column(
        Integer,
        ForeignKey("food_items.id"),
        nullable=False
    )

    qty = Column(
        Integer,
        nullable=False
    )

    price = Column(
        Numeric(12, 2),
        nullable=False
    )


# ============================================================
# EVENT DECORATION ITEMS
# Same concept as EVENT FOOD ITEMS
# ============================================================

class EventDecor(Base):
    __tablename__ = "event_decor"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id"),
        nullable=False
    )

    decor_id = Column(
        Integer,
        ForeignKey("decor_items.id"),
        nullable=False
    )

    qty = Column(
        Integer,
        nullable=False
    )

    price = Column(
        Numeric(12, 2),
        nullable=False
    )


class EventStaff(Base):
    __tablename__ = "event_staff"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)

# ============================================================
# STAFF ROLES
# ============================================================

class StaffRole(Base):
    __tablename__ = "staff_roles"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    role = Column(
        String(100),
        nullable=False,
        unique=True
    )

    wage = Column(
        Numeric(12, 2),
        nullable=False
    )


# ============================================================
# STAFF
# ============================================================

class Staff(Base):
    __tablename__ = "staff"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String(150),
        nullable=False
    )

    mobile = Column(
        String(20),
        nullable=False
    )

    role_id = Column(
        Integer,
        ForeignKey("staff_roles.id"),
        nullable=False
    )


# ============================================================
# STAFF PAYMENT
# ============================================================

class StaffPayment(Base):
    __tablename__ = "staff_payments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id"),
        nullable=True
    )

    staff_id = Column(
        Integer,
        ForeignKey("staff.id"),
        nullable=False
    )

    payment = Column(
        Numeric(12, 2),
        nullable=False
    )

    payment_date = Column(
        Date,
        nullable=True
    )

    note = Column(
        String(500),
        nullable=True
    )


# ============================================================
# SUB TEAM
# ============================================================

class SubTeam(Base):
    __tablename__ = "sub_teams"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id"),
        nullable=False
    )

    name = Column(
        String(150),
        nullable=False
    )

    note = Column(
        String(500),
        nullable=True
    )

    purpose = Column(
        String(250),
        nullable=True
    )

    phone = Column(
        String(20),
        nullable=True
    )

    amount = Column(
        Numeric(12, 2),
        default=0
    )


# ============================================================
# EVENT PAYMENTS (Client / Customer Payments)
# ============================================================

class EventPayment(Base):
    __tablename__ = "event_payments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id"),
        nullable=False,
        index=True
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False
    )

    payment_method = Column(
        String(50),
        nullable=True,
        default="Cash"
    )

    payment_type = Column(
        String(50),
        nullable=True,
        default="Advance"
    )

    payment_date = Column(
        Date,
        nullable=False
    )

    note = Column(
        String(500),
        nullable=True
    )


# ============================================================
# EXPENSES (Company Overhead & Event Expenses)
# ============================================================

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(
        String(200),
        nullable=False
    )

    category = Column(
        String(100),
        nullable=False,
        default="Miscellaneous"
    )

    amount = Column(
        Numeric(12, 2),
        nullable=False
    )

    expense_date = Column(
        Date,
        nullable=False
    )

    event_id = Column(
        Integer,
        ForeignKey("events.id"),
        nullable=True,
        index=True
    )

    payment_method = Column(
        String(50),
        nullable=True,
        default="Cash"
    )

    vendor = Column(
        String(150),
        nullable=True
    )

    bill_number = Column(
        String(100),
        nullable=True
    )

    note = Column(
        String(500),
        nullable=True
    )


# ============================================================
# USERS & ROLE BASED ACCESS CONTROL
# ============================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    username = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    password = Column(
        String(100),
        nullable=False
    )

    name = Column(
        String(100),
        nullable=False
    )

    role = Column(
        String(20),
        nullable=False  # 'admin' (full access), 'owner' (read only), 'manager' (staff payment page only)
    )


# ============================================================
# KITCHEN STAFF, WAGES & PAYMENTS
# ============================================================

class KitchenStaff(Base):
    __tablename__ = "kitchen_staff"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    mobile = Column(String(20), nullable=True)
    kitchen_role = Column(String(100), nullable=False)  # Head Chef, Cook, Assistant, Helper, Dishwasher, etc.
    wage_type = Column(String(20), nullable=False, default="monthly")  # 'monthly' or 'daily'
    wage_rate = Column(Numeric(12, 2), nullable=False, default=0)     # Monthly salary or Daily wage rate
    status = Column(String(20), nullable=False, default="active")     # 'active' or 'inactive'
    joined_date = Column(Date, nullable=True)
    address = Column(String(255), nullable=True)
    notes = Column(String(500), nullable=True)


class KitchenWage(Base):
    __tablename__ = "kitchen_wages"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("kitchen_staff.id", ondelete="CASCADE"), nullable=False)
    period = Column(String(50), nullable=False)                       # e.g., '2026-10' or '2026-10-20'
    wage_type = Column(String(20), nullable=False)                    # 'monthly' or 'daily'
    days_worked = Column(Numeric(6, 2), nullable=False, default=1)   # Days worked (for daily) or attendance
    base_rate = Column(Numeric(12, 2), nullable=False)                # Rate at time of wage calculation
    calculated_wage = Column(Numeric(12, 2), nullable=False)          # days_worked * base_rate or monthly rate
    bonus = Column(Numeric(12, 2), nullable=False, default=0)
    deduction = Column(Numeric(12, 2), nullable=False, default=0)
    total_wage = Column(Numeric(12, 2), nullable=False)               # calculated_wage + bonus - deduction
    date_recorded = Column(Date, nullable=False)
    notes = Column(String(500), nullable=True)


class KitchenPayment(Base):
    __tablename__ = "kitchen_payments"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("kitchen_staff.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_mode = Column(String(50), nullable=False, default="Cash")  # 'Cash', 'UPI', 'Bank Transfer', 'Cheque'
    reference_no = Column(String(100), nullable=True)
    note = Column(String(500), nullable=True)


