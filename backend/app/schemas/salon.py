from uuid import UUID

from pydantic import BaseModel, Field

from app.models.salon import SalonStatus, SalonGender


class ServiceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    price: float = Field(gt=0)
    duration_minutes: int = Field(default=60, gt=0, le=480)


class ServiceOut(BaseModel):
    id: UUID
    name: str
    price: float
    duration_minutes: int

    model_config = {"from_attributes": True}


class SalonCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    city: str = Field(min_length=2, max_length=100)
    address: str = Field(min_length=5, max_length=500)
    latitude: float | None = None
    longitude: float | None = None
    description: str | None = None
    gender: SalonGender = SalonGender.both


class SalonUpdate(BaseModel):
    name: str | None = None
    city: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    description: str | None = None
    gender: SalonGender | None = None
    status: SalonStatus | None = None


class SalonOut(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    city: str
    address: str
    latitude: float | None
    longitude: float | None
    description: str | None
    gender: SalonGender
    status: SalonStatus
    services: list[ServiceOut] = []
    avg_rating: float | None = None
    review_count: int = 0

    model_config = {"from_attributes": True}


class SalonListOut(BaseModel):
    id: UUID
    name: str
    city: str
    address: str
    latitude: float | None
    longitude: float | None
    description: str | None
    gender: SalonGender
    status: SalonStatus
    avg_rating: float | None = None
    review_count: int = 0
    distance_km: float | None = None

    model_config = {"from_attributes": True}
