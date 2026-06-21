"""Ensure demo admin user exists (safe to re-run)."""

import asyncio

from sqlalchemy import select

from app.database import async_session
from app.models.user import User, UserRole
from app.services.auth import hash_password


async def main() -> None:
    async with async_session() as db:
        existing = await db.execute(select(User).where(User.email == "admin@demo.com"))
        if existing.scalar_one_or_none():
            print("admin@demo.com already exists")
            return
        db.add(
            User(
                name="Demo Admin",
                email="admin@demo.com",
                role=UserRole.admin,
                password_hash=hash_password("password123"),
            )
        )
        await db.commit()
        print("Created admin@demo.com / password123")


if __name__ == "__main__":
    asyncio.run(main())
