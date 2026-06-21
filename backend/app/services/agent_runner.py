"""Runs Google ADK agents for chat with MCP tool access."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

from app.agents.salon_agents import agent_for_role
from app.schemas.agent import UIBlock
from app.services.agent_response_parser import extract_structured_from_events, parse_json_message

logger = logging.getLogger(__name__)

APP_NAME = "salonbook"
_session_service = InMemorySessionService()
_runners: dict[str, Runner] = {}


def reset_runners() -> None:
    """Clear cached runners (e.g. after code or model change)."""
    _runners.clear()


def _get_runner(role: str) -> Runner:
    if role not in _runners:
        agent = agent_for_role(role)
        _runners[role] = Runner(
            app_name=APP_NAME,
            agent=agent,
            session_service=_session_service,
        )
    return _runners[role]


def _extract_text_from_event(event) -> str | None:
    if not event.content or not event.content.parts:
        return None
    chunks: list[str] = []
    for part in event.content.parts:
        if part.text:
            chunks.append(part.text)
    return "\n".join(chunks) if chunks else None


def _action_to_message(action: str, payload: dict[str, Any] | None) -> str:
    payload = payload or {}
    if action == "select_salon":
        return f"User selected salon {payload.get('salon_id')} ({payload.get('name', '')}). Show services and available slots."
    if action == "select_service":
        return (
            f"User selected service {payload.get('service_id')} "
            f"({payload.get('name', '')}) at salon {payload.get('salon_id')}. Show available slots."
        )
    if action == "select_slot":
        return (
            f"User selected slot {payload.get('slot_id')} on {payload.get('slot_date')} "
            f"at {payload.get('slot_time')}. Confirm booking details."
        )
    if action == "confirm_booking":
        return (
            f"User confirmed booking: salon={payload.get('salon_id')}, "
            f"service={payload.get('service_id')}, slot={payload.get('slot_id')}. Create the booking."
        )
    if action == "compare_periods":
        return f"Compare earnings between {payload.get('period_a')} and {payload.get('period_b')}."
    if action == "view_earnings":
        year = payload.get("year")
        month = payload.get("month")
        return f"Show owner earnings for year={year}, month={month}."
    return f"User action: {action} with payload {json.dumps(payload)}"


async def run_chat(
    *,
    user_id: str,
    role: str,
    message: str,
    session_id: str | None = None,
    action: str | None = None,
    action_payload: dict[str, Any] | None = None,
) -> tuple[str, str, str, list[UIBlock]]:
    """Run agent and return (session_id, message, role, ui_blocks)."""
    if not session_id:
        session_id = str(uuid.uuid4())

    runner = _get_runner(role)

    session = await _session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        session = await _session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
            state={"user_id": user_id, "user_role": role},
        )

    user_text = message.strip()
    if action:
        user_text = _action_to_message(action, action_payload)
    if not user_text:
        user_text = "Hello"

    new_message = types.Content(role="user", parts=[types.Part(text=user_text)])
    collected_events = []

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
        state_delta={"user_id": user_id, "user_role": role},
    ):
        collected_events.append(event)

    structured = extract_structured_from_events(collected_events)
    if structured:
        return session_id, structured.message, role, structured.ui_blocks

    fallback_text = "I couldn't complete that request. Please try again."
    for event in reversed(collected_events):
        if event.is_final_response():
            text = _extract_text_from_event(event)
            if text:
                parsed = parse_json_message(text)
                if parsed:
                    return session_id, parsed.message, role, parsed.ui_blocks
                fallback_text = text
                break

    return session_id, fallback_text, role, []
