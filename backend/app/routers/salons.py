from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2 import WKTElement
from geoalchemy2.functions import ST_DWithin, ST_MakePoint, ST_SetSRID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.review import Review
from app.models.salon import Salon, SalonGender, SalonStatus, Service
from app.models.user import User, UserRole
from app.schemas.salon import SalonCreate, SalonListOut, SalonOut, SalonUpdate, ServiceCreate, ServiceOut
from app.services.auth import get_current_user
from app.services.deps import require_role

router = APIRouter(prefix="/salons", tags=["salons"])


def _point_wkt(lng: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


def _salon_rating_stats(reviews: list[Review]) -> tuple[float | None, int]:
    if not reviews:
        return None, 0
    avg = sum(r.rating for r in reviews) / len(reviews)
    return round(avg, 1), len(reviews)


def _to_salon_out(salon: Salon) -> SalonOut:
    avg, count = _salon_rating_stats(salon.reviews)
    return SalonOut(
        id=salon.id,
        owner_id=salon.owner_id,
        name=salon.name,
        city=salon.city,
        address=salon.address,
        latitude=salon.latitude,
        longitude=salon.longitude,
        description=salon.description,
        gender=salon.gender,
        status=salon.status,
        services=[ServiceOut.model_validate(s) for s in salon.services],
        avg_rating=avg,
        review_count=count,
    )


@router.get("", response_model=list[SalonListOut])
async def list_salons(
    city: str | None = None,
    gender: SalonGender | None = None,
    service_type: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    min_rating: float | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Salon)
        .where(Salon.status == SalonStatus.approved)
        .options(selectinload(Salon.reviews), selectinload(Salon.services))
    )

    if city:
        stmt = stmt.where(Salon.city.ilike(f"%{city}%"))

    if gender is not None:
        stmt = stmt.where(Salon.gender.in_([gender, SalonGender.both]))

    if lat is not None and lng is not None:
        point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
        stmt = stmt.where(
            Salon.location.isnot(None),
            ST_DWithin(Salon.location, point, radius_km * 1000),
        )

    result = await db.execute(stmt)
    salons = result.scalars().unique().all()

    output: list[SalonListOut] = []
    for salon in salons:
        avg, count = _salon_rating_stats(salon.reviews)
        if min_rating is not None and (avg is None or avg < min_rating):
            continue

        if service_type or min_price is not None or max_price is not None:
            services = salon.services
            if service_type:
                services = [s for s in services if service_type.lower() in s.name.lower()]
            if min_price is not None:
                services = [s for s in services if s.price >= min_price]
            if max_price is not None:
                services = [s for s in services if s.price <= max_price]
            if not services:
                continue

        distance_km = None
        if lat is not None and lng is not None and salon.latitude and salon.longitude:
            from math import asin, cos, radians, sin, sqrt

            dlat = radians(salon.latitude - lat)
            dlng = radians(salon.longitude - lng)
            a = sin(dlat / 2) ** 2 + cos(radians(lat)) * cos(radians(salon.latitude)) * sin(dlng / 2) ** 2
            distance_km = round(6371 * 2 * asin(sqrt(a)), 1)

        output.append(
            SalonListOut(
                id=salon.id,
                name=salon.name,
                city=salon.city,
                address=salon.address,
                latitude=salon.latitude,
                longitude=salon.longitude,
                description=salon.description,
                gender=salon.gender,
                status=salon.status,
                avg_rating=avg,
                review_count=count,
                distance_km=distance_km,
            )
        )

    if lat is not None and lng is not None:
        output.sort(key=lambda s: s.distance_km if s.distance_km is not None else 9999)

    return output


@router.get("/mine", response_model=list[SalonOut])
async def my_salons(
    user: User = Depends(require_role(UserRole.owner, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Salon)
        .where(Salon.owner_id == user.id)
        .options(selectinload(Salon.services), selectinload(Salon.reviews))
        .order_by(Salon.created_at.desc())
    )
    result = await db.execute(stmt)
    return [_to_salon_out(s) for s in result.scalars().unique().all()]


@router.get("/{salon_id}", response_model=SalonOut)
async def get_salon(salon_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Salon)
        .where(Salon.id == salon_id)
        .options(selectinload(Salon.services), selectinload(Salon.reviews))
    )
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    return _to_salon_out(salon)


@router.post("", response_model=SalonOut, status_code=status.HTTP_201_CREATED)
async def create_salon(
    payload: SalonCreate,
    user: User = Depends(require_role(UserRole.owner, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    salon = Salon(
        owner_id=user.id,
        name=payload.name,
        city=payload.city,
        address=payload.address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        description=payload.description,
        gender=payload.gender,
        status=SalonStatus.approved if user.role == UserRole.admin else SalonStatus.pending,
    )
    if payload.latitude is not None and payload.longitude is not None:
        salon.location = _point_wkt(payload.longitude, payload.latitude)

    db.add(salon)
    await db.commit()
    result = await db.execute(
        select(Salon)
        .where(Salon.id == salon.id)
        .options(selectinload(Salon.services), selectinload(Salon.reviews))
    )
    salon = result.scalar_one()
    return _to_salon_out(salon)


@router.patch("/{salon_id}", response_model=SalonOut)
async def update_salon(
    salon_id: UUID,
    payload: SalonUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Salon)
        .where(Salon.id == salon_id)
        .options(selectinload(Salon.services), selectinload(Salon.reviews))
    )
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")

    if user.role != UserRole.admin and salon.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your salon")

    data = payload.model_dump(exclude_unset=True)
    if user.role != UserRole.admin:
        data.pop("status", None)

    for key, value in data.items():
        setattr(salon, key, value)

    lat = data.get("latitude", salon.latitude)
    lng = data.get("longitude", salon.longitude)
    if lat is not None and lng is not None:
        salon.location = _point_wkt(lng, lat)

    await db.commit()
    await db.refresh(salon)
    return _to_salon_out(salon)


@router.post("/{salon_id}/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
async def add_service(
    salon_id: UUID,
    payload: ServiceCreate,
    user: User = Depends(require_role(UserRole.owner, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Salon).where(Salon.id == salon_id))
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")
    if user.role != UserRole.admin and salon.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your salon")

    service = Service(salon_id=salon_id, **payload.model_dump())
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return ServiceOut.model_validate(service)
