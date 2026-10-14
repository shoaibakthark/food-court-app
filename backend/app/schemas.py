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
class CreateEventRequest(BaseModel):

    customer: CustomerCreate

    event_date: date

    venue: str

    event_type: str

    guest_count: int

    notes: str | None = None

    food_amount: Decimal = 0

    decor_amount: Decimal = 0

    total_amount: Decimal = 0

    quote_amount: Decimal | None = None

    food_items: list[EventFoodItemCreate] = Field(
        default_factory=list
    )

    decor_items: list[EventDecorItemCreate] = Field(
        default_factory=list
    )
class FoodItemCreate(BaseModel):
    name: str
    price: Decimal = Field(ge=0)
    session_id: int
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


