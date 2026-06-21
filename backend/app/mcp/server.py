"""SalonBook MCP server — exposes marketplace DB/API tools for ADK agents."""

from __future__ import annotations

from typing import Any

from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_request

from app.services import agent_tools

mcp = FastMCP(
    name="SalonBook",
    instructions=(
        "Tools for the SalonBook beauty salon marketplace. "
        "Authenticated chat passes X-User-Id and X-User-Role headers."
    ),
)


def _actor() -> tuple[str, str]:
    request = get_http_request()
    user_id = request.headers.get("x-user-id")
    role = request.headers.get("x-user-role")
    if user_id and role:
        return user_id, role
    raise PermissionError("Missing user context (X-User-Id, X-User-Role headers).")


def _require_role(role: str, allowed: set[str]) -> None:
    if role not in allowed:
        raise PermissionError(f"Role '{role}' cannot use this tool")


@mcp.tool
def search_salons(
    city: str | None = None,
    service_type: str | None = None,
    min_rating: float | None = None,
) -> list[dict[str, Any]]:
    """Search approved salons by city, service keyword, or minimum rating."""
    return agent_tools.tool_search_salons(city=city, service_type=service_type, min_rating=min_rating)


@mcp.tool
def get_salon_details(salon_id: str) -> dict[str, Any] | None:
    """Get salon profile, services, and ratings."""
    return agent_tools.tool_get_salon(salon_id)


@mcp.tool
def list_available_slots(salon_id: str, slot_date: str | None = None) -> list[dict[str, Any]]:
    """List open appointment slots for a salon (YYYY-MM-DD optional)."""
    return agent_tools.tool_list_slots(salon_id, slot_date)


@mcp.tool
def create_booking(
    salon_id: str,
    service_id: str,
    slot_id: str,
) -> dict[str, Any]:
    """Book an appointment for the authenticated customer."""
    user_id, role = _actor()
    _require_role(role, {"customer"})
    return agent_tools.tool_create_booking(user_id, salon_id, service_id, slot_id)


@mcp.tool
def get_my_bookings() -> list[dict[str, Any]]:
    """List bookings for the authenticated customer."""
    user_id, role = _actor()
    _require_role(role, {"customer", "owner", "admin"})
    if role == "customer":
        return agent_tools.tool_my_bookings(user_id)
    return []


@mcp.tool
def get_owner_salons() -> list[dict[str, Any]]:
    """List salons owned by the authenticated owner."""
    user_id, role = _actor()
    _require_role(role, {"owner", "admin"})
    return agent_tools.tool_owner_salons(user_id)


@mcp.tool
def create_salon(
    name: str,
    city: str,
    address: str,
    description: str | None = None,
) -> dict[str, Any]:
    """Register a new salon for the authenticated owner (pending admin approval)."""
    user_id, role = _actor()
    _require_role(role, {"owner", "admin"})
    return agent_tools.tool_create_salon(user_id, name, city, address, description)


@mcp.tool
def add_salon_service(
    salon_id: str,
    name: str,
    price: float,
    duration_minutes: int = 60,
) -> dict[str, Any]:
    """Add a service to an owned salon."""
    user_id, role = _actor()
    _require_role(role, {"owner", "admin"})
    return agent_tools.tool_add_service(user_id, salon_id, name, price, duration_minutes)


@mcp.tool
def get_owner_earnings(
    year: int | None = None,
    month: int | None = None,
) -> dict[str, Any]:
    """Owner earnings and booking counts, optionally filtered by year/month."""
    user_id, role = _actor()
    _require_role(role, {"owner", "admin"})
    return agent_tools.tool_owner_earnings(user_id, year=year, month=month)


@mcp.tool
def compare_owner_earnings(
    period_a: str,
    period_b: str,
) -> dict[str, Any]:
    """Compare owner earnings between two periods (YYYY or YYYY-MM)."""
    user_id, role = _actor()
    _require_role(role, {"owner", "admin"})
    return agent_tools.tool_compare_earnings(user_id, period_a, period_b)


@mcp.tool
def get_platform_analytics() -> dict[str, Any]:
    """Admin platform-wide analytics: users, salons, bookings, revenue trends."""
    _user_id, role = _actor()
    _require_role(role, {"admin"})
    return agent_tools.tool_admin_analytics()


@mcp.tool
def list_top_clients(limit: int = 20) -> list[dict[str, Any]]:
    """Admin list of clients ranked by booking activity."""
    _user_id, role = _actor()
    _require_role(role, {"admin"})
    return agent_tools.tool_admin_clients(limit=limit)


@mcp.tool
def list_salons_admin(status: str | None = None) -> list[dict[str, Any]]:
    """Admin salon list filtered by status (pending, approved, rejected)."""
    _user_id, role = _actor()
    _require_role(role, {"admin"})
    return agent_tools.tool_admin_salons(status=status)
