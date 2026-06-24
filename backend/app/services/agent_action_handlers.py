"""Deterministic chat actions — skip the LLM for UI button flows."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from app.schemas.agent import UIBlock
from app.services import agent_tools
from app.services.agent_ui_builder import _salon_list_block

_METRO_CITIES = ("Mumbai", "Delhi", "Bangalore", "Pune", "Hyderabad", "Chennai", "Kolkata")


def _extract_city(text: str) -> str | None:
    low = text.lower()
    for city in _METRO_CITIES:
        if city.lower() in low:
            return city
    match = re.search(r"\b(?:in|near|at)\s+([A-Za-z][A-Za-z\s]{2,20})", text, re.I)
    if match:
        return agent_tools._normalize_city(match.group(1).strip())
    return None


async def try_handle_search_intent(
    message: str,
) -> tuple[str, list[UIBlock]] | None:
    """Fast-path salon search — returns cards without calling the LLM."""
    text = message.strip()
    if len(text) < 4:
        return None
    low = text.lower()
    if any(w in low for w in ("booking", "bookings", "appointment", "my booking")):
        return None
    if not any(w in low for w in ("salon", "salons", "hair", "spa", "groom", "facial")):
        return None

    city = _extract_city(text)
    service_type = None
    if "hair" in low:
        service_type = "hair"
    elif "facial" in low:
        service_type = "facial"
    elif "spa" in low:
        service_type = "spa"

    salons = await agent_tools._with_db(
        lambda db: agent_tools.search_salons(db, city=city, service_type=service_type)
    )
    if not salons:
        where = f" in {city}" if city else ""
        return f"No salons found{where} right now. Try another city or check the home page.", []

    where = f" in {city}" if city else ""
    block = _salon_list_block(salons, title=f"Salons{where}")
    return (
        f"Here are {len(salons)} salon{'s' if len(salons) != 1 else ''}{where}. Tap one to book:",
        [block] if block else [],
    )


async def try_handle_action(
    *,
    role: str,
    user_id: str,
    action: str,
    payload: dict[str, Any] | None,
) -> tuple[str, list[UIBlock]] | None:
    payload = payload or {}

    if role == "customer":
        return await _customer_action(user_id, action, payload)
    if role == "owner":
        return await _owner_action(user_id, action, payload)
    return None


async def _customer_action(
    user_id: str, action: str, payload: dict[str, Any]
) -> tuple[str, list[UIBlock]] | None:
    if action == "select_salon":
        salon_id = payload.get("salon_id")
        if not salon_id:
            return None
        salon = await agent_tools._with_db(
            lambda db: agent_tools.get_salon_details(db, UUID(str(salon_id)))
        )
        if not salon:
            return "Salon not found.", []
        name = salon.get("name", "this salon")
        return (
            f"Choose a service at {name}:",
            [
                UIBlock(
                    type="service_picker",
                    title=name,
                    data={"salon_id": salon["id"], "services": salon.get("services", [])},
                )
            ],
        )

    if action == "select_service":
        salon_id = payload.get("salon_id")
        service_id = payload.get("service_id")
        if not salon_id or not service_id:
            return None
        slots = await agent_tools._with_db(
            lambda db: agent_tools.list_available_slots(db, salon_id=UUID(str(salon_id)))
        )
        svc_name = payload.get("name", "your service")
        if not slots:
            days = settings.agent_slot_days
            return (
                f"No open times in the next {days} days for {svc_name} at this salon. "
                "Try another service or salon.",
                [],
            )
        return (
            f"Pick a time for {svc_name}:",
            [
                UIBlock(
                    type="slot_picker",
                    title="Available slots",
                    data={
                        "salon_id": str(salon_id),
                        "service_id": str(service_id),
                        "slots": slots,
                    },
                )
            ],
        )

    if action == "select_slot":
        summary = {
            "salon_id": str(payload.get("salon_id", "")),
            "service_id": str(payload.get("service_id", "")),
            "slot_id": str(payload.get("slot_id", "")),
            "date": str(payload.get("slot_date", "")),
            "time": str(payload.get("slot_time", "")),
            "service": str(payload.get("name", payload.get("service_name", ""))),
            "price": payload.get("price", payload.get("service_price", "")),
        }
        return (
            "Please confirm your booking:",
            [UIBlock(type="booking_summary", title="Booking summary", data=summary)],
        )

    if action == "confirm_booking":
        salon_id = payload.get("salon_id")
        service_id = payload.get("service_id")
        slot_id = payload.get("slot_id")
        if not all([salon_id, service_id, slot_id]):
            return "Missing booking details. Please start again.", []
        result = await agent_tools._with_db(
            lambda db: agent_tools.create_booking_for_user(
                db,
                user_id=UUID(user_id),
                salon_id=UUID(str(salon_id)),
                service_id=UUID(str(service_id)),
                slot_id=UUID(str(slot_id)),
            )
        )
        if isinstance(result, dict) and result.get("error"):
            return str(result["error"]), []
        return (
            f"Booked {result.get('service_name')} on {result.get('slot_date')} at {result.get('slot_time')}. "
            "See you at the salon!",
            [],
        )

    return None


async def _owner_action(
    user_id: str, action: str, payload: dict[str, Any]
) -> tuple[str, list[UIBlock]] | None:
    if action == "view_earnings":
        year = payload.get("year")
        month = payload.get("month")
        stats = await agent_tools._with_db(
            lambda db: agent_tools.get_owner_earnings(
                db,
                owner_id=UUID(user_id),
                year=int(year) if year else None,
                month=int(month) if month else None,
            )
        )
        if year and month:
            label = f"{year}-{int(month):02d}"
        elif year:
            label = str(year)
        else:
            label = "all time"
        return (
            f"Earnings for {label}: ₹{stats['total_earnings']:,.0f} ({stats['booking_count']} bookings).",
            [UIBlock(type="earnings_chart", title="Earnings", data=stats)],
        )

    if action == "compare_periods":
        period_a = str(payload.get("period_a", ""))
        period_b = str(payload.get("period_b", ""))
        if not period_a or not period_b:
            return None
        data = await agent_tools._with_db(
            lambda db: agent_tools.compare_owner_periods(
                db, owner_id=UUID(user_id), period_a=period_a, period_b=period_b
            )
        )
        return (
            f"Comparing {period_a} vs {period_b}.",
            [UIBlock(type="comparison_chart", title="Period comparison", data=data)],
        )

    return None
