from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


# ============================================================
# CUSTOMER
# ============================================================

class CustomerCreate(BaseModel):

    name: str = Field(
        min_length=1,
        max_length=150
    )

    mobile: str = Field(
        min_length=5,
        max_length=20
    )



# ============================================================
# CUSTOMER UPDATE
# ============================================================

class CustomerUpdate(BaseModel):

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=150
    )

    mobile: str | None = Field(
        default=None,
        min_length=5,
        max_length=20
    )


# ============================================================
# CUSTOMER RESPONSE
# ============================================================

class CustomerResponse(BaseModel):

    id: int

    name: str

    mobile: str

    event_count: int = 0

    model_config = {
        "from_attributes": True
    }

# ============================================================
# EVENT FOOD ITEM
# ============================================================

class EventFoodItemCreate(BaseModel):

    food_item_id: int

    quantity: int = Field(
        gt=0
    )

    price: Decimal = Field(
        ge=0
    )


# ============================================================
# EVENT DECOR ITEM
# ============================================================

class EventDecorItemCreate(BaseModel):

    decor_item_id: int

    quantity: int = Field(
        gt=0
    )

    price: Decimal = Field(
        ge=0
    )


class FoodItemCreate(BaseModel):
    name: str
    price: Decimal = Field(ge=0)
    session_id: int


# ============================================================
# EVENT EQUIPMENT ITEM
# ============================================================

class EventEquipmentItemCreate(BaseModel):

    equipment_id: int

    quantity: int = Field(
        gt=0
    )

    note: str | None = None


# ============================================================
# COMPLETE EVENT
# ============================================================

class CreateEventRequest(BaseModel):

    # --------------------------------------------------------
    # CUSTOMER
    # --------------------------------------------------------

    customer: CustomerCreate

    # --------------------------------------------------------
    # EVENT DETAILS
    # --------------------------------------------------------

    event_date: date

    venue: str

    event_type: str

    guest_count: int = Field(
        gt=0
    )

    # --------------------------------------------------------
    # FOOD
    # --------------------------------------------------------

    food_items: list[EventFoodItemCreate] = Field(
        default_factory=list
    )

    # --------------------------------------------------------
    # DECOR
    # --------------------------------------------------------

    decor_items: list[EventDecorItemCreate] = Field(
        default_factory=list
    )

    # --------------------------------------------------------
    # EQUIPMENT
    # --------------------------------------------------------

    equipment_items: list[EventEquipmentItemCreate] = Field(
        default_factory=list
    )

    # --------------------------------------------------------
    # AMOUNTS
    # --------------------------------------------------------

    food_amount: Decimal = Field(
        default=0,
        ge=0
    )

    decor_amount: Decimal = Field(
        default=0,
        ge=0
    )

    total_amount: Decimal = Field(
        default=0,
        ge=0
    )

    quote_amount: Decimal | None = Field(
        default=None,
        ge=0
    )


# ============================================================
# EVENT RESPONSE
# ============================================================

class EventResponse(BaseModel):

    id: int

    customer_id: int

    date: date

    place: str

    event_type: str

    guest_count: int

    food_amt: Decimal

    decor_amt: Decimal

    total_estimate: Decimal

    quote: Decimal | None

    model_config = {
        "from_attributes": True
    }


# ============================================================
# STAFF ROLE SCHEMAS
# Separate Module
# ============================================================

class StaffRoleCreate(BaseModel):

    role: str

    wage: Decimal


class StaffRoleResponse(BaseModel):

    id: int

    role: str

    wage: Decimal

    model_config = {
        "from_attributes": True
    }


# ============================================================
# STAFF SCHEMAS
# Separate Module
# ============================================================

class StaffCreate(BaseModel):

    name: str

    mobile: str

    role_id: int


class StaffResponse(BaseModel):

    id: int

    name: str

    mobile: str

    role_id: int

    model_config = {
        "from_attributes": True
    }


# ============================================================
# STAFF PAYMENT SCHEMAS
# Separate Module
# ============================================================

class StaffPaymentCreate(BaseModel):
    event_id: int | None = None
    staff_id: int
    payment: Decimal
    payment_date: date | None = None
    note: str | None = None


class StaffPaymentResponse(BaseModel):
    id: int
    event_id: int | None = None
    staff_id: int
    payment: Decimal
    payment_date: date | None = None
    note: str | None = None
    staff_name: str | None = None
    staff_role: str | None = None

    model_config = {
        "from_attributes": True
    }


# ============================================================
# SUB TEAM SCHEMAS
# Separate Module
# ============================================================

class SubTeamCreate(BaseModel):

    event_id: int

    name: str

    note: str | None = None

    purpose: str | None = None

    phone: str | None = None

    amount: Decimal = 0


class SubTeamResponse(BaseModel):

    id: int

    event_id: int

    name: str

    note: str | None = None

    purpose: str | None = None

    phone: str | None = None

    amount: Decimal

    model_config = {
        "from_attributes": True
    }


# ============================================================
# EVENT PAYMENT SCHEMAS
# ============================================================

class EventPaymentCreate(BaseModel):
    event_id: int
    amount: Decimal = Field(gt=0)
    payment_method: str | None = "Cash"
    payment_type: str | None = "Advance"
    payment_date: date | None = None
    note: str | None = None


class EventPaymentResponse(BaseModel):
    id: int
    event_id: int
    amount: Decimal
    payment_method: str | None = None
    payment_type: str | None = None
    payment_date: date
    note: str | None = None

    model_config = {
        "from_attributes": True
    }


# ============================================================
# EXPENSE SCHEMAS
# ============================================================

class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str = "Miscellaneous"
    amount: Decimal = Field(gt=0)
    expense_date: date | None = None
    event_id: int | None = None
    payment_method: str | None = "Cash"
    vendor: str | None = None
    bill_number: str | None = None
    note: str | None = None


class ExpenseUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    amount: Decimal | None = None
    expense_date: date | None = None
    event_id: int | None = None
    payment_method: str | None = None
    vendor: str | None = None
    bill_number: str | None = None
    note: str | None = None


class ExpenseResponse(BaseModel):
    id: int
    title: str
    category: str
    amount: Decimal
    expense_date: date
    event_id: int | None = None
    payment_method: str | None = None
    vendor: str | None = None
    bill_number: str | None = None
    note: str | None = None

    model_config = {
        "from_attributes": True
    }


# ============================================================
# KITCHEN STAFF SCHEMAS
# ============================================================

class KitchenStaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    mobile: str | None = None
    kitchen_role: str = Field(min_length=1, max_length=100)
    wage_type: str = "monthly"  # 'monthly' or 'daily'
    wage_rate: Decimal = Field(ge=0, default=Decimal("0.00"))
    status: str = "active"      # 'active' or 'inactive'
    joined_date: date | None = None
    address: str | None = None
    notes: str | None = None


class KitchenStaffUpdate(BaseModel):
    name: str | None = None
    mobile: str | None = None
    kitchen_role: str | None = None
    wage_type: str | None = None
    wage_rate: Decimal | None = None
    status: str | None = None
    joined_date: date | None = None
    address: str | None = None
    notes: str | None = None


class KitchenStaffResponse(BaseModel):
    id: int
    name: str
    mobile: str | None = None
    kitchen_role: str
    wage_type: str
    wage_rate: Decimal
    status: str
    joined_date: date | None = None
    address: str | None = None
    notes: str | None = None
    duties_count: int = 0
    total_wages: Decimal = Decimal("0.00")
    total_paid: Decimal = Decimal("0.00")
    balance: Decimal = Decimal("0.00")

    model_config = {
        "from_attributes": True
    }


# ============================================================
# KITCHEN WAGE SCHEMAS
# ============================================================

class KitchenWageCreate(BaseModel):
    staff_id: int
    period: str = Field(min_length=1, max_length=50)
    wage_type: str | None = None
    days_worked: Decimal = Field(gt=0, default=Decimal("1.0"))
    base_rate: Decimal | None = None
    bonus: Decimal = Field(ge=0, default=Decimal("0.00"))
    deduction: Decimal = Field(ge=0, default=Decimal("0.00"))
    date_recorded: date | None = None
    notes: str | None = None


class KitchenAutoWageRequest(BaseModel):
    staff_ids: list[int] | None = None
    period: str = Field(min_length=1, max_length=50)
    days_worked: Decimal = Field(gt=0, default=Decimal("1.0"))
    date_recorded: date | None = None


class KitchenWageResponse(BaseModel):
    id: int
    staff_id: int
    staff_name: str | None = None
    period: str
    wage_type: str
    days_worked: Decimal
    base_rate: Decimal
    calculated_wage: Decimal
    bonus: Decimal
    deduction: Decimal
    total_wage: Decimal
    date_recorded: date
    notes: str | None = None

    model_config = {
        "from_attributes": True
    }


# ============================================================
# KITCHEN PAYMENT SCHEMAS
# ============================================================

class KitchenPaymentCreate(BaseModel):
    staff_id: int
    amount: Decimal = Field(gt=0)
    payment_date: date | None = None
    payment_mode: str = "Cash"  # 'Cash', 'UPI', 'Bank Transfer', 'Cheque'
    reference_no: str | None = None
    note: str | None = None


class KitchenPaymentResponse(BaseModel):
    id: int
    staff_id: int
    staff_name: str | None = None
    amount: Decimal
    payment_date: date
    payment_mode: str
    reference_no: str | None = None
    note: str | None = None

    model_config = {
        "from_attributes": True
    }


# ============================================================
# KITCHEN SUMMARY SCHEMAS
# ============================================================

class KitchenSummaryResponse(BaseModel):
    total_staff: int
    active_staff: int
    monthly_staff_count: int
    daily_staff_count: int
    total_wages: Decimal
    total_paid: Decimal
    total_pending_balance: Decimal
    today_duties_count: int = 0
    today_duty_wages: Decimal = Decimal("0.00")


# ============================================================
# KITCHEN DAILY DUTY SCHEMAS
# ============================================================

class KitchenDutyCreate(BaseModel):
    staff_id: int
    duty_date: date | None = None
    shift: str = "Full Day"
    duty_status: str = "present"  # 'present', 'half', 'absent', 'full', 'double', 'overtime'
    duty_units: Decimal = Decimal("1.0")
    daily_rate: Decimal | None = None
    today_wage: Decimal | None = None
    bonus: Decimal = Field(ge=0, default=Decimal("0.00"))
    deduction: Decimal = Field(ge=0, default=Decimal("0.00"))
    paid_today: bool = False
    paid_amount: Decimal | None = None
    payment_mode: str = "Cash"
    note: str | None = None


class KitchenBatchDutyItem(BaseModel):
    staff_id: int
    shift: str = "Full Day"
    duty_status: str = "present"
    duty_units: Decimal = Decimal("1.0")
    daily_rate: Decimal | None = None
    today_wage: Decimal | None = None
    bonus: Decimal = Field(ge=0, default=Decimal("0.00"))
    deduction: Decimal = Field(ge=0, default=Decimal("0.00"))
    paid_today: bool = False
    paid_amount: Decimal | None = None
    payment_mode: str = "Cash"
    note: str | None = None


class KitchenBatchDutyRequest(BaseModel):
    duty_date: date
    duties: list[KitchenBatchDutyItem]


class KitchenDutyResponse(BaseModel):
    id: int
    staff_id: int
    staff_name: str | None = None
    kitchen_role: str | None = None
    wage_type: str | None = None
    duty_date: date
    shift: str
    duty_status: str
    duty_units: Decimal
    daily_rate: Decimal
    duty_wage: Decimal
    bonus: Decimal
    deduction: Decimal
    total_wage: Decimal
    today_wage: Decimal | None = None
    paid_today: bool = False
    paid_amount: Decimal = Decimal("0.00")
    payment_mode: str = "Cash"
    note: str | None = None

    model_config = {
        "from_attributes": True
    }




