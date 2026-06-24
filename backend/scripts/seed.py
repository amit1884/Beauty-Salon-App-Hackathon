"""Seed demo data for local development."""

import asyncio
import random
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from geoalchemy2 import WKTElement
from sqlalchemy import select

from app.database import async_session
from app.models.booking import AvailabilitySlot, Booking, BookingStatus, PaymentStatus
from app.models.review import Review
from app.models.salon import Salon, SalonGender, SalonStatus, Service
from app.models.user import User, UserRole
from app.services.auth import hash_password
from app.services import agent_tools

METRO_SEED_TAG = "[metro-seed-v2]"
PASSWORD = "password123"

# (name, area, service_profile)
SALON_TEMPLATES: list[tuple[str, str, str]] = [
    ("Glow Hair Studio", "hair", "Expert cuts, colour & styling for every hair type."),
    ("Serenity Spa & Wellness", "spa", "Massages, body treatments and relaxation therapies."),
    ("Bridal Bliss Lounge", "bridal", "Bridal makeup, party looks and pre-wedding packages."),
    ("Urban Men's Grooming", "mens", "Haircuts, beard styling and grooming for men."),
    ("Pearl Nail & Beauty Bar", "nails", "Manicures, pedicures, nail art and lash extensions."),
]

SERVICE_PROFILES: dict[str, list[tuple[str, float, int]]] = {
    "hair": [
        ("Haircut", 499, 45),
        ("Hair Colour", 2499, 120),
        ("Keratin Treatment", 4999, 150),
        ("Blow Dry & Styling", 799, 40),
    ],
    "spa": [
        ("Swedish Massage", 1799, 60),
        ("Deep Tissue Massage", 2199, 75),
        ("Body Polishing", 1999, 90),
        ("Aromatherapy", 1599, 60),
    ],
    "bridal": [
        ("Bridal Makeup", 12999, 180),
        ("Party Makeup", 3499, 90),
        ("Saree Draping", 999, 30),
        ("Pre-Bridal Facial", 2499, 75),
    ],
    "mens": [
        ("Men's Haircut", 399, 30),
        ("Beard Trim & Shape", 299, 20),
        ("Head Massage", 599, 30),
        ("Hair Spa", 899, 45),
    ],
    "nails": [
        ("Classic Manicure", 599, 40),
        ("Gel Manicure", 899, 45),
        ("Spa Pedicure", 999, 50),
        ("Nail Art", 1299, 60),
    ],
}

PROFILE_GENDER: dict[str, SalonGender] = {
    "hair": SalonGender.both,
    "spa": SalonGender.both,
    "bridal": SalonGender.female,
    "mens": SalonGender.male,
    "nails": SalonGender.female,
}

METRO_CITIES: dict[str, dict[str, Any]] = {
    "Mumbai": {
        "lat": 19.0760,
        "lng": 72.8777,
        "areas": ["Bandra West", "Andheri East", "Powai", "Juhu", "Colaba"],
    },
    "Delhi": {
        "lat": 28.6139,
        "lng": 77.2090,
        "areas": ["Connaught Place", "Saket", "Hauz Khas", "Karol Bagh", "Dwarka"],
    },
    "Bengaluru": {
        "lat": 12.9716,
        "lng": 77.5946,
        "areas": ["Koramangala", "Indiranagar", "Whitefield", "Jayanagar", "HSR Layout"],
    },
    "Chennai": {
        "lat": 13.0827,
        "lng": 80.2707,
        "areas": ["T Nagar", "Anna Nagar", "Adyar", "Velachery", "Nungambakkam"],
    },
    "Hyderabad": {
        "lat": 17.3850,
        "lng": 78.4867,
        "areas": ["Banjara Hills", "Jubilee Hills", "Gachibowli", "Madhapur", "Secunderabad"],
    },
    "Kolkata": {
        "lat": 22.5726,
        "lng": 88.3639,
        "areas": ["Park Street", "Salt Lake", "Ballygunge", "New Town", "Alipore"],
    },
    "Pune": {
        "lat": 18.5204,
        "lng": 73.8567,
        "areas": ["Koregaon Park", "Baner", "Hinjewadi", "Kothrud", "Viman Nagar"],
    },
}

EXTRA_CUSTOMERS = [
    ("Ananya Sharma", "ananya@demo.com"),
    ("Rahul Mehta", "rahul@demo.com"),
    ("Priya Nair", "priya@demo.com"),
    ("Vikram Singh", "vikram@demo.com"),
    ("Sneha Reddy", "sneha@demo.com"),
    ("Arjun Kapoor", "arjun@demo.com"),
    ("Meera Iyer", "meera@demo.com"),
]

EXTRA_OWNERS = [
    ("Delhi Owner", "owner.delhi@demo.com", "Delhi"),
    ("Bengaluru Owner", "owner.bengaluru@demo.com", "Bengaluru"),
    ("Chennai Owner", "owner.chennai@demo.com", "Chennai"),
    ("Hyderabad Owner", "owner.hyderabad@demo.com", "Hyderabad"),
    ("Kolkata Owner", "owner.kolkata@demo.com", "Kolkata"),
    ("Pune Owner", "owner.pune@demo.com", "Pune"),
]


def _offset_coords(lat: float, lng: float, index: int) -> tuple[float, float]:
    return round(lat + (index - 2) * 0.018, 4), round(lng + (index - 2) * 0.014, 4)


async def _metro_seed_exists(db) -> bool:
    result = await db.execute(
        select(Salon.id).where(Salon.description.like(f"%{METRO_SEED_TAG}%")).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _get_or_create_user(
    db,
    *,
    name: str,
    email: str,
    role: UserRole,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user
    user = User(
        name=name,
        email=email,
        role=role,
        password_hash=hash_password(PASSWORD),
    )
    db.add(user)
    await db.flush()
    return user


async def _create_salon_with_services(
    db,
    *,
    owner: User,
    name: str,
    city: str,
    area: str,
    lat: float,
    lng: float,
    profile: str,
    blurb: str,
    gender: SalonGender | None = None,
) -> tuple[Salon, list[Service]]:
    salon = Salon(
        owner_id=owner.id,
        name=name,
        city=city,
        address=f"{area}, {city}",
        latitude=lat,
        longitude=lng,
        location=WKTElement(f"POINT({lng} {lat})", srid=4326),
        description=f"{blurb} {METRO_SEED_TAG}",
        gender=gender or PROFILE_GENDER[profile],
        status=SalonStatus.approved,
    )
    db.add(salon)
    await db.flush()

    services = [
        Service(salon_id=salon.id, name=n, price=p, duration_minutes=d)
        for n, p, d in SERVICE_PROFILES[profile]
    ]
    db.add_all(services)
    await db.flush()
    return salon, services


async def _add_future_slots(db, salon: Salon, days: int = 7) -> list[AvailabilitySlot]:
    slots: list[AvailabilitySlot] = []
    today = date.today()
    for day_offset in range(days):
        slot_date = today + timedelta(days=day_offset)
        for hour in (10, 12, 15, 17):
            slot = AvailabilitySlot(
                salon_id=salon.id,
                slot_date=slot_date,
                slot_time=time(hour, 0),
            )
            db.add(slot)
            slots.append(slot)
    await db.flush()
    return slots


async def _seed_booking_history(
    db,
    *,
    salons: list[tuple[Salon, list[Service]]],
    customers: list[User],
) -> None:
    """Spread confirmed/completed bookings across the last 12 months for owner analytics."""
    random.seed(42)
    month_weights = [4, 5, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20]

    for months_ago, weight in enumerate(reversed(month_weights)):
        month_start = (date.today().replace(day=1) - timedelta(days=months_ago * 31)).replace(day=1)
        for _ in range(weight):
            salon, services = random.choice(salons)
            service = random.choice(services)
            customer = random.choice(customers)
            day = random.randint(1, 28)
            try:
                slot_date = month_start.replace(day=day)
            except ValueError:
                slot_date = month_start.replace(day=28)
            hour = random.choice([10, 11, 12, 14, 15, 16, 17])
            created_at = datetime(
                month_start.year,
                month_start.month,
                min(day, 28),
                random.randint(9, 20),
                random.randint(0, 59),
                tzinfo=timezone.utc,
            ) - timedelta(days=random.randint(1, 10))

            status = BookingStatus.completed if random.random() < 0.65 else BookingStatus.confirmed
            payment = PaymentStatus.paid if status == BookingStatus.completed else PaymentStatus.unpaid

            slot = AvailabilitySlot(
                salon_id=salon.id,
                slot_date=slot_date,
                slot_time=time(hour, 0),
                is_booked=True,
            )
            db.add(slot)
            await db.flush()

            booking = Booking(
                customer_id=customer.id,
                salon_id=salon.id,
                service_id=service.id,
                slot_id=slot.id,
                status=status,
                payment_status=payment,
                created_at=created_at,
            )
            db.add(booking)

    await db.flush()


async def _seed_reviews(
    db,
    *,
    salons: list[Salon],
    customers: list[User],
) -> None:
    random.seed(7)
    comments = [
        "Wonderful experience, will visit again!",
        "Professional staff and great ambience.",
        "Good value for money.",
        "Loved the service quality.",
        "Clean salon and on-time appointment.",
    ]
    for salon in salons:
        reviewers = random.sample(customers, k=min(3, len(customers)))
        for customer in reviewers:
            db.add(
                Review(
                    salon_id=salon.id,
                    customer_id=customer.id,
                    rating=random.randint(4, 5),
                    comment=random.choice(comments),
                )
            )
    await db.flush()


async def _backfill_salon_genders(db) -> None:
    result = await db.execute(select(Salon))
    for salon in result.scalars():
        gender = SalonGender.both
        if "Urban Men's Grooming" in salon.name:
            gender = SalonGender.male
        elif "Bridal Bliss" in salon.name:
            gender = SalonGender.female
        elif "Pearl Nail" in salon.name:
            gender = SalonGender.female
        salon.gender = gender
    await db.flush()


async def seed() -> None:
    async with async_session() as db:
        if await _metro_seed_exists(db):
            await _backfill_salon_genders(db)
            refreshed = await agent_tools.ensure_future_slots(db)
            await db.commit()
            print("Metro seed data already exists — salon genders backfilled")
            if refreshed:
                print(f"  Added {refreshed} availability slots for the upcoming week")
            print(f"  Log in: owner@demo.com / {PASSWORD}")
            return

        owner = await _get_or_create_user(
            db, name="Demo Owner", email="owner@demo.com", role=UserRole.owner
        )
        customer = await _get_or_create_user(
            db, name="Demo Customer", email="customer@demo.com", role=UserRole.customer
        )
        await _get_or_create_user(
            db, name="Demo Admin", email="admin@demo.com", role=UserRole.admin
        )

        customers = [customer]
        for name, email in EXTRA_CUSTOMERS:
            customers.append(
                await _get_or_create_user(db, name=name, email=email, role=UserRole.customer)
            )

        city_owners: dict[str, User] = {"Mumbai": owner}
        for name, email, city in EXTRA_OWNERS:
            city_owners[city] = await _get_or_create_user(
                db, name=name, email=email, role=UserRole.owner
            )

        owner_salons: list[tuple[Salon, list[Service]]] = []
        all_salons: list[Salon] = []

        for city, meta in METRO_CITIES.items():
            city_owner = city_owners[city]
            for index, (salon_name, profile, blurb) in enumerate(SALON_TEMPLATES):
                area = meta["areas"][index]
                lat, lng = _offset_coords(meta["lat"], meta["lng"], index)
                display_name = f"{salon_name} {city}"
                salon, services = await _create_salon_with_services(
                    db,
                    owner=city_owner,
                    name=display_name,
                    city=city,
                    area=area,
                    lat=lat,
                    lng=lng,
                    profile=profile,
                    blurb=blurb,
                )
                await _add_future_slots(db, salon)
                all_salons.append(salon)
                if city == "Mumbai":
                    owner_salons.append((salon, services))

        await _seed_booking_history(db, salons=owner_salons, customers=customers)
        await _seed_reviews(db, salons=all_salons, customers=customers)

        await db.commit()

        print("Metro seed complete!")
        print(f"  {len(METRO_CITIES)} cities × {len(SALON_TEMPLATES)} salons = {len(all_salons)} salons")
        print(f"  Demo owner (Mumbai): owner@demo.com / {PASSWORD}")
        print(f"  Customer: customer@demo.com / {PASSWORD}")
        print(f"  Admin: admin@demo.com / {PASSWORD}")
        print("  Owner analytics: ask AI chat 'Show my earnings' or compare months")


if __name__ == "__main__":
    asyncio.run(seed())
