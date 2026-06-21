from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.review import Review
from app.models.salon import Salon
from app.models.user import User, UserRole
from app.schemas.booking import ReviewCreate, ReviewOut
from app.services.deps import require_role

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/salon/{salon_id}", response_model=list[ReviewOut])
async def list_reviews(salon_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Review).where(Review.salon_id == salon_id).order_by(Review.created_at.desc())
    )
    return [ReviewOut.model_validate(r) for r in result.scalars().all()]


@router.post("/salon/{salon_id}", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    salon_id: UUID,
    payload: ReviewCreate,
    user: User = Depends(require_role(UserRole.customer)),
    db: AsyncSession = Depends(get_db),
):
    salon_result = await db.execute(select(Salon).where(Salon.id == salon_id))
    if not salon_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salon not found")

    existing = await db.execute(
        select(Review).where(Review.salon_id == salon_id, Review.customer_id == user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already reviewed this salon")

    review = Review(salon_id=salon_id, customer_id=user.id, **payload.model_dump())
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return ReviewOut.model_validate(review)
