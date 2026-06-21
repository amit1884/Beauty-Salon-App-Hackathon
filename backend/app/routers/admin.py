from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.review import Review
from app.models.salon import Salon, SalonStatus
from app.models.user import User, UserRole
from app.routers.salons import _to_salon_out
from app.schemas.salon import SalonOut
from app.services.deps import require_role

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/salons", response_model=list[SalonOut])
async def list_salons_for_admin(
    status: SalonStatus | None = Query(default=None),
    user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Salon).options(selectinload(Salon.services), selectinload(Salon.reviews))
    if status:
        stmt = stmt.where(Salon.status == status)
    stmt = stmt.order_by(Salon.created_at.desc())

    result = await db.execute(stmt)
    return [_to_salon_out(s) for s in result.scalars().unique().all()]


@router.patch("/salons/{salon_id}/status", response_model=SalonOut)
async def set_salon_status(
    salon_id: UUID,
    status: SalonStatus,
    user: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    if status not in (SalonStatus.approved, SalonStatus.rejected, SalonStatus.pending):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    result = await db.execute(
        select(Salon)
        .where(Salon.id == salon_id)
        .options(selectinload(Salon.services), selectinload(Salon.reviews))
    )
    salon = result.scalar_one_or_none()
    if not salon:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")

    salon.status = status
    await db.commit()
    await db.refresh(salon)
    return _to_salon_out(salon)
