"""Seed demo data for local development."""

import asyncio
import uuid
from datetime import date, time, timedelta

from geoalchemy2 import WKTElement
from sqlalchemy import select

from app.database import async_session
from app.models.booking import AvailabilitySlot
from app.models.salon import Salon, SalonStatus, Service
from app.models.user import User, UserRole
from app.services.auth import hash_password


async def seed() -> None:
    async with async_session() as db:
        existing = await db.execute(select(User).where(User.email == "owner@demo.com"))
        if existing.scalar_one_or_none():
            print("Seed data already exists — skipping")
            return

        owner = User(
            name="Demo Owner",
            email="owner@demo.com",
            role=UserRole.owner,
            password_hash=hash_password("password123"),
        )
        customer = User(
            name="Demo Customer",
            email="customer@demo.com",
            role=UserRole.customer,
            password_hash=hash_password("password123"),
        )
        admin_user = User(
            name="Demo Admin",
            email="admin@demo.com",
            role=UserRole.admin,
            password_hash=hash_password("password123"),
        )
        db.add_all([owner, customer, admin_user])
        await db.flush()

        salons_data = [
            ("Glow Studio", "Mumbai", "Bandra West", 19.0596, 72.8295),
            ("Luxe Hair & Spa", "Mumbai", "Andheri East", 19.1136, 72.8697),
            ("Bliss Beauty Bar", "Pune", "Koregaon Park", 18.5362, 73.8937),
        ]

        for name, city, area, lat, lng in salons_data:
            salon = Salon(
                owner_id=owner.id,
                name=name,
                city=city,
                address=f"{area}, {city}",
                latitude=lat,
                longitude=lng,
                location=WKTElement(f"POINT({lng} {lat})", srid=4326),
                description=f"Premium beauty services at {name}.",
                status=SalonStatus.approved,
            )
            db.add(salon)
            await db.flush()

            services = [
                Service(salon_id=salon.id, name="Haircut", price=499, duration_minutes=45),
                Service(salon_id=salon.id, name="Facial", price=1299, duration_minutes=60),
                Service(salon_id=salon.id, name="Bridal Makeup", price=8999, duration_minutes=180),
            ]
            db.add_all(services)

            today = date.today()
            for day_offset in range(3):
                slot_date = today + timedelta(days=day_offset)
                for hour in (10, 12, 15, 17):
                    db.add(
                        AvailabilitySlot(
                            salon_id=salon.id,
                            slot_date=slot_date,
                            slot_time=time(hour, 0),
                        )
                    )

        await db.commit()
        print("Seed complete!")
        print("  owner@demo.com / password123")
        print("  customer@demo.com / password123")
        print("  admin@demo.com / password123  (approves salons)")


if __name__ == "__main__":
    asyncio.run(seed())
