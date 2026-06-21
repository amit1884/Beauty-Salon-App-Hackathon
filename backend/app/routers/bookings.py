from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.booking import AvailabilitySlot, Booking, BookingStatus
from app.models.salon import Salon, Service
from app.models.user import User, UserRole
from app.schemas.booking import BookingCreate, BookingDetailOut, BookingOut, SlotCreate, SlotOut
from app.services.deps import require_role

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.get("/slots", response_model=list[SlotOut])
async def list_available_slots(
    salon_id: UUID,
    slot_date: date | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AvailabilitySlot).where(
        AvailabilitySlot.salon_id == salon_id,
        AvailabilitySlot.is_booked.is_(False),
    )
    if slot_date:
        stmt = stmt.where(AvailabilitySlot.slot_date == slot_date)
    stmt = stmt.order_by(AvailabilitySlot.slot_date, AvailabilitySlot.slot_time)

    result = await db.execute(stmt)
    return [SlotOut.model_validate(s) for s in result.scalars().all()]


@router.get("/slots/manage", response_model=list[SlotOut])
async def list_salon_slots_manage(
    salon_id: UUID,
    user: User = Depends(require_role(UserRole.owner, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Salon).where(Salon.id == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    if user.role != UserRole.admin and salon.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your salon")

    stmt = (
        select(AvailabilitySlot)
        .where(AvailabilitySlot.salon_id == salon_id)
        .order_by(AvailabilitySlot.slot_date, AvailabilitySlot.slot_time)
    )
    slots = await db.execute(stmt)
    return [SlotOut.model_validate(s) for s in slots.scalars().all()]


@router.post("/slots", response_model=SlotOut, status_code=status.HTTP_201_CREATED)
async def create_slot(
    salon_id: UUID,
    payload: SlotCreate,
    user: User = Depends(require_role(UserRole.owner, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Salon).where(Salon.id == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    if user.role != UserRole.admin and salon.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your salon")

    slot = AvailabilitySlot(salon_id=salon_id, **payload.model_dump())
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return SlotOut.model_validate(slot)


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    slot_result = await db.execute(
        select(AvailabilitySlot).where(
            AvailabilitySlot.id == payload.slot_id,
            AvailabilitySlot.salon_id == payload.salon_id,
            AvailabilitySlot.is_booked.is_(False),
        )
    )
    slot = slot_result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slot unavailable")

    service_result = await db.execute(
        select(Service).where(Service.id == payload.service_id, Service.salon_id == payload.salon_id)
    )
    if not service_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid service")

    slot.is_booked = True
    booking = Booking(
        customer_id=user.id,
        salon_id=payload.salon_id,
        service_id=payload.service_id,
        slot_id=payload.slot_id,
        status=BookingStatus.confirmed,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return BookingOut.model_validate(booking)


@router.get("/my", response_model=list[BookingDetailOut])
async def my_bookings(
    user: User = Depends(require_role(UserRole.customer, UserRole.owner, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Booking, Salon, Service, AvailabilitySlot, User)
        .join(Salon, Booking.salon_id == Salon.id)
        .join(Service, Booking.service_id == Service.id)
        .join(AvailabilitySlot, Booking.slot_id == AvailabilitySlot.id)
        .join(User, Booking.customer_id == User.id)
    )
    if user.role == UserRole.customer:
        stmt = stmt.where(Booking.customer_id == user.id)
    elif user.role == UserRole.owner:
        stmt = stmt.where(Salon.owner_id == user.id)

    result = await db.execute(stmt.order_by(Booking.created_at.desc()))
    rows = result.all()

    return [
        BookingDetailOut(
            id=booking.id,
            salon_id=salon.id,
            salon_name=salon.name,
            salon_city=salon.city,
            salon_address=salon.address,
            service_name=service.name,
            service_price=service.price,
            slot_date=slot.slot_date,
            slot_time=slot.slot_time,
            status=booking.status,
            payment_status=booking.payment_status,
            created_at=booking.created_at,
            customer_name=customer.name if user.role in (UserRole.owner, UserRole.admin) else None,
        )
        for booking, salon, service, slot, customer in rows
    ]
