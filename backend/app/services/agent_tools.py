"""Shared DB/API operations used by the MCP server and analytics endpoints."""

from __future__ import annotations

import asyncio
from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import async_session
from app.models.booking import AvailabilitySlot, Booking, BookingStatus
from app.models.salon import Salon, SalonGender, SalonStatus, Service
from app.models.user import User, UserRole
from app.routers.salons import _salon_rating_stats, _to_salon_out


def _run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    import concurrent.futures

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(asyncio.run, coro).result()


async def _with_db(fn):
    async with async_session() as db:
        return await fn(db)


def _serialize_salon_list_item(salon: Salon) -> dict[str, Any]:
    avg, count = _salon_rating_stats(salon.reviews)
    return {
        "id": str(salon.id),
        "name": salon.name,
        "city": salon.city,
        "address": salon.address,
        "avg_rating": avg,
        "review_count": count,
    }


def _serialize_salon(salon: Salon, include_services: bool = True) -> dict[str, Any]:
    data = _serialize_salon_list_item(salon)
    data["gender"] = salon.gender.value
    if include_services:
        data["services"] = [
            {
                "id": str(s.id),
                "name": s.name,
                "price": s.price,
                "duration_minutes": s.duration_minutes,
            }
            for s in salon.services
        ]
    return data


async def _get_user(db: AsyncSession, user_id: UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


_SERVICE_STOP_WORDS = frozenset({"salon", "salons", "shop", "near", "in", "the", "a", "an", "and", "or", "for"})


def _service_search_terms(service_type: str) -> list[str]:
    return [
        term
        for term in service_type.lower().replace("-", " ").split()
        if len(term) >= 3 and term not in _SERVICE_STOP_WORDS
    ]


def _matches_service_type(services: list[Service], service_type: str) -> bool:
    needle = service_type.lower().strip()
    if not needle:
        return True
    if any(needle in service.name.lower() for service in services):
        return True
    terms = _service_search_terms(needle)
    if not terms:
        return True
    return any(any(term in service.name.lower() for term in terms) for service in services)


def _normalize_city(city: str | None) -> str | None:
    if not city:
        return None
    cleaned = city.strip().split(",")[0].split("-")[0].strip()
    aliases = {"bombay": "Mumbai", "bengaluru": "Bangalore", "bangalore": "Bangalore"}
    return aliases.get(cleaned.lower(), cleaned)


async def ensure_future_slots(
    db: AsyncSession,
    *,
    salon_id: UUID | None = None,
    days: int | None = None,
) -> int:
    """Ensure each approved salon has open slots for the upcoming window (idempotent)."""
    horizon = days if days is not None else settings.agent_slot_days
    today = date.today()
    end = today + timedelta(days=horizon)
    slot_hours = (10, 12, 15, 17)

    stmt = select(Salon).where(Salon.status == SalonStatus.approved)
    if salon_id:
        stmt = stmt.where(Salon.id == salon_id)
    salons = (await db.execute(stmt)).scalars().all()

    created = 0
    for salon in salons:
        for day_offset in range(horizon + 1):
            slot_date = today + timedelta(days=day_offset)
            if slot_date > end:
                break
            for hour in slot_hours:
                slot_time = time(hour, 0)
                row = (
                    await db.execute(
                        select(AvailabilitySlot.id)
                        .where(
                            AvailabilitySlot.salon_id == salon.id,
                            AvailabilitySlot.slot_date == slot_date,
                            AvailabilitySlot.slot_time == slot_time,
                        )
                        .limit(1)
                    )
                ).first()
                if row:
                    continue
                db.add(
                    AvailabilitySlot(
                        salon_id=salon.id,
                        slot_date=slot_date,
                        slot_time=slot_time,
                    )
                )
                created += 1
    if created:
        await db.flush()
    return created


async def search_salons(
    db: AsyncSession,
    *,
    city: str | None = None,
    gender: str | None = None,
    service_type: str | None = None,
    min_rating: float | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    max_results = limit or settings.agent_search_limit
    city = _normalize_city(city)
    stmt = (
        select(Salon)
        .where(Salon.status == SalonStatus.approved)
        .options(selectinload(Salon.reviews), selectinload(Salon.services))
        .limit(max_results * 3)
    )
    if city:
        stmt = stmt.where(Salon.city.ilike(f"%{city}%"))
    if gender:
        try:
            gender_enum = SalonGender(gender)
            stmt = stmt.where(Salon.gender.in_([gender_enum, SalonGender.both]))
        except ValueError:
            pass

    result = await db.execute(stmt)
    salons = result.scalars().unique().all()
    output: list[dict[str, Any]] = []
    for salon in salons:
        avg, count = _salon_rating_stats(salon.reviews)
        if min_rating is not None and (avg is None or avg < min_rating):
            continue
        if service_type:
            if not _matches_service_type(salon.services, service_type):
                continue
        output.append(_serialize_salon_list_item(salon))
        if len(output) >= max_results:
            break
    return output


async def get_salon_details(db: AsyncSession, salon_id: UUID) -> dict[str, Any] | None:
    result = await db.execute(
        select(Salon)
        .where(Salon.id == salon_id)
        .options(selectinload(Salon.services), selectinload(Salon.reviews))
    )
    salon = result.scalar_one_or_none()
    if not salon:
        return None
    return _serialize_salon(salon)


async def list_available_slots(
    db: AsyncSession,
    *,
    salon_id: UUID,
    slot_date: date | None = None,
) -> list[dict[str, Any]]:
    from datetime import timedelta

    stmt = select(AvailabilitySlot).where(
        AvailabilitySlot.salon_id == salon_id,
        AvailabilitySlot.is_booked.is_(False),
    )
    if slot_date:
        stmt = stmt.where(AvailabilitySlot.slot_date == slot_date)
    else:
        today = date.today()
        end = today + timedelta(days=settings.agent_slot_days)
        stmt = stmt.where(
            AvailabilitySlot.slot_date >= today,
            AvailabilitySlot.slot_date <= end,
        )
    stmt = stmt.order_by(AvailabilitySlot.slot_date, AvailabilitySlot.slot_time).limit(
        settings.agent_slot_limit
    )
    result = await db.execute(stmt)
    return [
        {
            "id": str(s.id),
            "slot_date": s.slot_date.isoformat(),
            "slot_time": s.slot_time.strftime("%H:%M"),
        }
        for s in result.scalars().all()
    ]


async def create_booking_for_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    salon_id: UUID,
    service_id: UUID,
    slot_id: UUID,
) -> dict[str, Any]:
    user = await _get_user(db, user_id)
    if not user or user.role != UserRole.customer:
        return {"error": "Only customers can create bookings"}

    slot_result = await db.execute(
        select(AvailabilitySlot).where(
            AvailabilitySlot.id == slot_id,
            AvailabilitySlot.salon_id == salon_id,
            AvailabilitySlot.is_booked.is_(False),
        )
    )
    slot = slot_result.scalar_one_or_none()
    if not slot:
        return {"error": "Slot unavailable"}

    service_result = await db.execute(
        select(Service).where(Service.id == service_id, Service.salon_id == salon_id)
    )
    service = service_result.scalar_one_or_none()
    if not service:
        return {"error": "Invalid service"}

    slot.is_booked = True
    booking = Booking(
        customer_id=user_id,
        salon_id=salon_id,
        service_id=service_id,
        slot_id=slot_id,
        status=BookingStatus.confirmed,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return {
        "id": str(booking.id),
        "status": booking.status.value,
        "salon_id": str(salon_id),
        "service_name": service.name,
        "service_price": service.price,
        "slot_date": slot.slot_date.isoformat(),
        "slot_time": slot.slot_time.strftime("%H:%M"),
    }


async def get_customer_bookings(db: AsyncSession, user_id: UUID) -> list[dict[str, Any]]:
    stmt = (
        select(Booking, Salon, Service, AvailabilitySlot)
        .join(Salon, Booking.salon_id == Salon.id)
        .join(Service, Booking.service_id == Service.id)
        .join(AvailabilitySlot, Booking.slot_id == AvailabilitySlot.id)
        .where(Booking.customer_id == user_id)
        .order_by(Booking.created_at.desc())
        .limit(10)
    )
    result = await db.execute(stmt)
    return [
        {
            "id": str(booking.id),
            "salon_name": salon.name,
            "service_name": service.name,
            "service_price": service.price,
            "slot_date": slot.slot_date.isoformat(),
            "slot_time": slot.slot_time.strftime("%H:%M"),
            "status": booking.status.value,
        }
        for booking, salon, service, slot in result.all()
    ]


async def get_owner_salons(db: AsyncSession, owner_id: UUID) -> list[dict[str, Any]]:
    stmt = (
        select(Salon)
        .where(Salon.owner_id == owner_id)
        .options(selectinload(Salon.services), selectinload(Salon.reviews))
        .order_by(Salon.created_at.desc())
    )
    result = await db.execute(stmt)
    return [_serialize_salon(s) for s in result.scalars().unique().all()]


async def create_salon_for_owner(
    db: AsyncSession,
    *,
    owner_id: UUID,
    name: str,
    city: str,
    address: str,
    description: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    gender: SalonGender = SalonGender.both,
) -> dict[str, Any]:
    user = await _get_user(db, owner_id)
    if not user or user.role not in (UserRole.owner, UserRole.admin):
        return {"error": "Only owners can create salons"}

    salon = Salon(
        owner_id=owner_id,
        name=name,
        city=city,
        address=address,
        description=description,
        latitude=latitude,
        longitude=longitude,
        gender=gender,
        status=SalonStatus.approved if user.role == UserRole.admin else SalonStatus.pending,
    )
    db.add(salon)
    await db.commit()
    await db.refresh(salon)
    return _serialize_salon(salon)


async def add_service_to_salon(
    db: AsyncSession,
    *,
    owner_id: UUID,
    salon_id: UUID,
    name: str,
    price: float,
    duration_minutes: int = 60,
) -> dict[str, Any]:
    result = await db.execute(select(Salon).where(Salon.id == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        return {"error": "Salon not found"}
    user = await _get_user(db, owner_id)
    if not user or (user.role != UserRole.admin and salon.owner_id != owner_id):
        return {"error": "Not your salon"}

    service = Service(
        salon_id=salon_id,
        name=name,
        price=price,
        duration_minutes=duration_minutes,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return {
        "id": str(service.id),
        "name": service.name,
        "price": service.price,
        "duration_minutes": service.duration_minutes,
    }


async def _owner_booking_rows(db: AsyncSession, owner_id: UUID):
    stmt = (
        select(Booking, Service, Salon, User)
        .join(Salon, Booking.salon_id == Salon.id)
        .join(Service, Booking.service_id == Service.id)
        .join(User, Booking.customer_id == User.id)
        .where(Salon.owner_id == owner_id)
        .where(Booking.status.in_([BookingStatus.confirmed, BookingStatus.completed]))
    )
    return (await db.execute(stmt)).all()


async def get_owner_earnings(
    db: AsyncSession,
    *,
    owner_id: UUID,
    year: int | None = None,
    month: int | None = None,
) -> dict[str, Any]:
    rows = await _owner_booking_rows(db, owner_id)
    total = 0.0
    booking_count = 0
    by_month: dict[str, dict[str, float | int]] = {}

    for booking, service, salon, _customer in rows:
        created = booking.created_at
        if year and created.year != year:
            continue
        if month and created.month != month:
            continue
        total += service.price
        booking_count += 1
        key = f"{created.year}-{created.month:02d}"
        bucket = by_month.setdefault(key, {"earnings": 0.0, "bookings": 0})
        bucket["earnings"] = float(bucket["earnings"]) + service.price
        bucket["bookings"] = int(bucket["bookings"]) + 1

    return {
        "total_earnings": round(total, 2),
        "booking_count": booking_count,
        **(
            {}
            if year is not None and month is not None
            else {
                "by_month": [
                    {"period": k, "earnings": round(v["earnings"], 2), "bookings": v["bookings"]}
                    for k, v in sorted(by_month.items())[-12:]
                ]
            }
        ),
    }


async def compare_owner_periods(
    db: AsyncSession,
    *,
    owner_id: UUID,
    period_a: str,
    period_b: str,
) -> dict[str, Any]:
    async def _period_stats(period: str) -> dict[str, Any]:
        year, month = _parse_period(period)
        stats = await get_owner_earnings(db, owner_id=owner_id, year=year, month=month)
        return {
            "period": period,
            "earnings": stats["total_earnings"],
            "bookings": stats["booking_count"],
        }

    a = await _period_stats(period_a)
    b = await _period_stats(period_b)
    earnings_delta = round(b["earnings"] - a["earnings"], 2)
    bookings_delta = b["bookings"] - a["bookings"]
    pct = round((earnings_delta / a["earnings"]) * 100, 1) if a["earnings"] else None
    return {
        "period_a": a,
        "period_b": b,
        "earnings_change": earnings_delta,
        "bookings_change": bookings_delta,
        "earnings_change_percent": pct,
    }


def _parse_period(period: str) -> tuple[int, int | None]:
    parts = period.strip().split("-")
    if len(parts) == 1:
        return int(parts[0]), None
    if len(parts) == 2:
        return int(parts[0]), int(parts[1])
    raise ValueError(f"Invalid period format: {period}. Use YYYY or YYYY-MM")


async def get_admin_analytics(db: AsyncSession) -> dict[str, Any]:
    users = (await db.execute(select(func.count(User.id)))).scalar_one()
    salons = (await db.execute(select(func.count(Salon.id)))).scalar_one()
    pending = (
        await db.execute(select(func.count(Salon.id)).where(Salon.status == SalonStatus.pending))
    ).scalar_one()
    bookings = (await db.execute(select(func.count(Booking.id)))).scalar_one()
    revenue = (
        await db.execute(
            select(func.coalesce(func.sum(Service.price), 0))
            .select_from(Booking)
            .join(Service, Booking.service_id == Service.id)
            .where(Booking.status.in_([BookingStatus.confirmed, BookingStatus.completed]))
        )
    ).scalar_one()

    monthly = (
        await db.execute(
            select(
                extract("year", Booking.created_at).label("year"),
                extract("month", Booking.created_at).label("month"),
                func.count(Booking.id).label("bookings"),
                func.coalesce(func.sum(Service.price), 0).label("revenue"),
            )
            .join(Service, Booking.service_id == Service.id)
            .where(Booking.status.in_([BookingStatus.confirmed, BookingStatus.completed]))
            .group_by("year", "month")
            .order_by("year", "month")
        )
    ).all()

    trends = [
        {
            "period": f"{int(row.year)}-{int(row.month):02d}",
            "bookings": int(row.bookings),
            "revenue": round(float(row.revenue or 0), 2),
        }
        for row in monthly
    ]
    return {
        "total_users": users,
        "total_salons": salons,
        "pending_salons": pending,
        "total_bookings": bookings,
        "platform_revenue": round(float(revenue or 0), 2),
        "monthly_trends": trends[-6:],
    }


async def list_admin_clients(db: AsyncSession, limit: int = 20) -> list[dict[str, Any]]:
    stmt = (
        select(
            User.id,
            User.name,
            User.email,
            User.role,
            func.count(Booking.id).label("booking_count"),
        )
        .outerjoin(Booking, Booking.customer_id == User.id)
        .group_by(User.id)
        .order_by(func.count(Booking.id).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": str(row.id),
            "name": row.name,
            "role": row.role.value,
            "booking_count": int(row.booking_count or 0),
        }
        for row in rows
    ]


async def list_admin_salons(db: AsyncSession, status: str | None = None) -> list[dict[str, Any]]:
    stmt = select(Salon).options(selectinload(Salon.reviews))
    if status:
        stmt = stmt.where(Salon.status == SalonStatus(status))
    stmt = stmt.order_by(Salon.created_at.desc()).limit(15)
    result = await db.execute(stmt)
    return [
        {**_serialize_salon_list_item(s), "status": s.status.value}
        for s in result.scalars().unique().all()
    ]


# Sync wrappers for MCP tools (run in thread pool)
def tool_search_salons(
    city: str | None = None,
    gender: str | None = None,
    service_type: str | None = None,
    min_rating: float | None = None,
):
    return _run_async(
        _with_db(lambda db: search_salons(db, city=city, gender=gender, service_type=service_type, min_rating=min_rating))
    )


def tool_get_salon(salon_id: str):
    return _run_async(_with_db(lambda db: get_salon_details(db, UUID(salon_id))))


def tool_list_slots(salon_id: str, slot_date: str | None = None):
    parsed = date.fromisoformat(slot_date) if slot_date else None
    return _run_async(_with_db(lambda db: list_available_slots(db, salon_id=UUID(salon_id), slot_date=parsed)))


def tool_create_booking(user_id: str, salon_id: str, service_id: str, slot_id: str):
    return _run_async(
        _with_db(
            lambda db: create_booking_for_user(
                db,
                user_id=UUID(user_id),
                salon_id=UUID(salon_id),
                service_id=UUID(service_id),
                slot_id=UUID(slot_id),
            )
        )
    )


def tool_my_bookings(user_id: str):
    return _run_async(_with_db(lambda db: get_customer_bookings(db, UUID(user_id))))


def tool_owner_salons(owner_id: str):
    return _run_async(_with_db(lambda db: get_owner_salons(db, UUID(owner_id))))


def tool_create_salon(
    owner_id: str,
    name: str,
    city: str,
    address: str,
    description: str | None = None,
    gender: str = "both",
):
    gender_enum = SalonGender(gender) if gender in SalonGender._value2member_map_ else SalonGender.both
    return _run_async(
        _with_db(
            lambda db: create_salon_for_owner(
                db,
                owner_id=UUID(owner_id),
                name=name,
                city=city,
                address=address,
                description=description,
                gender=gender_enum,
            )
        )
    )


def tool_add_service(owner_id: str, salon_id: str, name: str, price: float, duration_minutes: int = 60):
    return _run_async(
        _with_db(
            lambda db: add_service_to_salon(
                db,
                owner_id=UUID(owner_id),
                salon_id=UUID(salon_id),
                name=name,
                price=price,
                duration_minutes=duration_minutes,
            )
        )
    )


def tool_owner_earnings(owner_id: str, year: int | None = None, month: int | None = None):
    return _run_async(_with_db(lambda db: get_owner_earnings(db, owner_id=UUID(owner_id), year=year, month=month)))


def tool_compare_earnings(owner_id: str, period_a: str, period_b: str):
    return _run_async(
        _with_db(lambda db: compare_owner_periods(db, owner_id=UUID(owner_id), period_a=period_a, period_b=period_b))
    )


def tool_admin_analytics():
    return _run_async(_with_db(get_admin_analytics))


def tool_admin_clients(limit: int = 20):
    return _run_async(_with_db(lambda db: list_admin_clients(db, limit=limit)))


def tool_admin_salons(status: str | None = None):
    return _run_async(_with_db(lambda db: list_admin_salons(db, status=status)))
