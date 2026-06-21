"""ADK function tools — async DB access in the same event loop as FastAPI/ADK."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from google.adk.tools.tool_context import ToolContext

from app.services import agent_tools


def _actor(tool_context: ToolContext) -> tuple[str, str]:
    state = dict(tool_context.state)
    user_id = state.get("user_id")
    role = state.get("user_role")
    if not user_id or not role:
        raise PermissionError("Missing user session context.")
    return str(user_id), str(role)


def _require_role(role: str, allowed: set[str]) -> None:
    if role not in allowed:
        raise PermissionError(f"Role '{role}' cannot use this tool.")


async def search_salons(
    city: str | None = None,
    service_type: str | None = None,
    min_rating: float | None = None,
) -> list[dict[str, Any]]:
    """Search approved salons by city, service keyword, or minimum rating."""
    return await agent_tools._with_db(
        lambda db: agent_tools.search_salons(db, city=city, service_type=service_type, min_rating=min_rating)
    )


async def get_salon_details(salon_id: str) -> dict[str, Any] | None:
    """Get salon profile, services, and ratings."""
    return await agent_tools._with_db(lambda db: agent_tools.get_salon_details(db, UUID(salon_id)))


async def list_available_slots(salon_id: str, slot_date: str | None = None) -> list[dict[str, Any]]:
    """List open appointment slots for a salon (YYYY-MM-DD optional)."""
    from datetime import date

    parsed = date.fromisoformat(slot_date) if slot_date else None
    return await agent_tools._with_db(
        lambda db: agent_tools.list_available_slots(db, salon_id=UUID(salon_id), slot_date=parsed)
    )


async def create_booking(
    salon_id: str,
    service_id: str,
    slot_id: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Book an appointment for the authenticated customer."""
    user_id, role = _actor(tool_context)
    _require_role(role, {"customer"})
    return await agent_tools._with_db(
        lambda db: agent_tools.create_booking_for_user(
            db,
            user_id=UUID(user_id),
            salon_id=UUID(salon_id),
            service_id=UUID(service_id),
            slot_id=UUID(slot_id),
        )
    )


async def get_my_bookings(tool_context: ToolContext) -> list[dict[str, Any]]:
    """List bookings for the authenticated customer."""
    user_id, role = _actor(tool_context)
    _require_role(role, {"customer"})
    return await agent_tools._with_db(lambda db: agent_tools.get_customer_bookings(db, UUID(user_id)))


async def get_owner_salons(tool_context: ToolContext) -> list[dict[str, Any]]:
    """List salons owned by the authenticated owner."""
    user_id, role = _actor(tool_context)
    _require_role(role, {"owner", "admin"})
    return await agent_tools._with_db(lambda db: agent_tools.get_owner_salons(db, UUID(user_id)))


async def create_salon(
    name: str,
    city: str,
    address: str,
    tool_context: ToolContext,
    description: str | None = None,
) -> dict[str, Any]:
    """Register a new salon for the authenticated owner (pending admin approval)."""
    user_id, role = _actor(tool_context)
    _require_role(role, {"owner", "admin"})
    return await agent_tools._with_db(
        lambda db: agent_tools.create_salon_for_owner(
            db,
            owner_id=UUID(user_id),
            name=name,
            city=city,
            address=address,
            description=description,
        )
    )


async def add_salon_service(
    salon_id: str,
    name: str,
    price: float,
    tool_context: ToolContext,
    duration_minutes: int = 60,
) -> dict[str, Any]:
    """Add a service to an owned salon."""
    user_id, role = _actor(tool_context)
    _require_role(role, {"owner", "admin"})
    return await agent_tools._with_db(
        lambda db: agent_tools.add_service_to_salon(
            db,
            owner_id=UUID(user_id),
            salon_id=UUID(salon_id),
            name=name,
            price=price,
            duration_minutes=duration_minutes,
        )
    )


async def get_owner_earnings(
    tool_context: ToolContext,
    year: int | None = None,
    month: int | None = None,
) -> dict[str, Any]:
    """Owner earnings and booking counts, optionally filtered by year/month."""
    user_id, role = _actor(tool_context)
    _require_role(role, {"owner", "admin"})
    return await agent_tools._with_db(
        lambda db: agent_tools.get_owner_earnings(db, owner_id=UUID(user_id), year=year, month=month)
    )


async def compare_owner_earnings(
    period_a: str,
    period_b: str,
    tool_context: ToolContext,
) -> dict[str, Any]:
    """Compare owner earnings between two periods (YYYY or YYYY-MM)."""
    user_id, role = _actor(tool_context)
    _require_role(role, {"owner", "admin"})
    return await agent_tools._with_db(
        lambda db: agent_tools.compare_owner_periods(
            db, owner_id=UUID(user_id), period_a=period_a, period_b=period_b
        )
    )


async def get_platform_analytics(tool_context: ToolContext) -> dict[str, Any]:
    """Admin platform-wide analytics: users, salons, bookings, revenue trends."""
    _user_id, role = _actor(tool_context)
    _require_role(role, {"admin"})
    return await agent_tools._with_db(agent_tools.get_admin_analytics)


async def list_top_clients(tool_context: ToolContext, limit: int = 20) -> list[dict[str, Any]]:
    """Admin list of clients ranked by booking activity."""
    _user_id, role = _actor(tool_context)
    _require_role(role, {"admin"})
    return await agent_tools._with_db(lambda db: agent_tools.list_admin_clients(db, limit=limit))


async def list_salons_admin(tool_context: ToolContext, status: str | None = None) -> list[dict[str, Any]]:
    """Admin salon list filtered by status (pending, approved, rejected)."""
    _user_id, role = _actor(tool_context)
    _require_role(role, {"admin"})
    return await agent_tools._with_db(lambda db: agent_tools.list_admin_salons(db, status=status))


CUSTOMER_TOOLS = [
    search_salons,
    get_salon_details,
    list_available_slots,
    create_booking,
    get_my_bookings,
]

OWNER_TOOLS = CUSTOMER_TOOLS + [
    get_owner_salons,
    create_salon,
    add_salon_service,
    get_owner_earnings,
    compare_owner_earnings,
]

ADMIN_TOOLS = OWNER_TOOLS + [
    get_platform_analytics,
    list_top_clients,
    list_salons_admin,
]
