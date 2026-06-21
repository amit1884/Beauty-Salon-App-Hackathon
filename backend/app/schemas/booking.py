from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.booking import BookingStatus, PaymentStatus


class SlotCreate(BaseModel):
    slot_date: date
    slot_time: time


class SlotOut(BaseModel):
    id: UUID
    slot_date: date
    slot_time: time
    is_booked: bool

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    salon_id: UUID
    service_id: UUID
    slot_id: UUID


class BookingOut(BaseModel):
    id: UUID
    customer_id: UUID
    salon_id: UUID
    service_id: UUID
    slot_id: UUID
    status: BookingStatus
    payment_status: PaymentStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class BookingDetailOut(BaseModel):
    id: UUID
    salon_id: UUID
    salon_name: str
    salon_city: str
    salon_address: str
    service_name: str
    service_price: float
    slot_date: date
    slot_time: time
    status: BookingStatus
    payment_status: PaymentStatus
    created_at: datetime
    customer_name: str | None = None


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewOut(BaseModel):
    id: UUID
    salon_id: UUID
    customer_id: UUID
    rating: int
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
