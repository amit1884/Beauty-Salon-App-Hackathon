"""Runs Google ADK agents for chat with MCP tool access."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types
from google.genai.errors import APIError, ServerError

from app.agents.salon_agents import agent_for_role
from app.config import settings
from app.schemas.agent import UIBlock
from app.services.agent_action_handlers import try_handle_action, try_handle_search_intent
from app.services.agent_response_parser import extract_structured_from_events, parse_json_message
from app.services.agent_ui_builder import build_ui_blocks_from_events, merge_response_blocks

logger = logging.getLogger(__name__)

APP_NAME = "salonbook"
_session_service = InMemorySessionService()
_runners: dict[str, Runner] = {}

BUSY_MESSAGE = (
    "The AI service is temporarily busy. Please try again in a moment, "
    "or browse salons from the home page."
)


class AgentLlmError(Exception):
    """LLM call failed after retries — safe to show in chat."""

    def __init__(self, user_message: str = BUSY_MESSAGE):
        self.user_message = user_message
        super().__init__(user_message)


def reset_runners() -> None:
    """Clear cached runners (e.g. after code or model change)."""
    _runners.clear()


def _models_to_try() -> list[str]:
    models = [settings.llm_model]
    fallback = settings.llm_model_fallback
    if fallback and fallback not in models:
        models.append(fallback)
    return models


def _is_retryable_llm_error(exc: Exception) -> bool:
    if isinstance(exc, ServerError):
        return True
    if isinstance(exc, APIError):
        code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
        if code in (429, 500, 503):
            return True
        message = str(exc).upper()
        return "UNAVAILABLE" in message or "RESOURCE_EXHAUSTED" in message or "OVERLOAD" in message
    return False


def _get_runner(role: str, model: str) -> Runner:
    key = f"{role}:{model}"
    if key not in _runners:
        agent = agent_for_role(role, model=model)
        _runners[key] = Runner(
            app_name=APP_NAME,
            agent=agent,
            session_service=_session_service,
        )
    return _runners[key]


def _extract_text_from_event(event) -> str | None:
    if not event.content or not event.content.parts:
        return None
    chunks: list[str] = []
    for part in event.content.parts:
        if part.text:
            chunks.append(part.text)
    return "\n".join(chunks) if chunks else None


def _action_to_message(action: str, payload: dict[str, Any] | None) -> str:
    """Short action hints — detailed handling is done without the LLM when possible."""
    payload = payload or {}
    if action == "select_salon":
        return f"Show services for salon {payload.get('salon_id')}."
    if action == "select_service":
        return f"Show slots for service {payload.get('service_id')} at salon {payload.get('salon_id')}."
    if action == "select_slot":
        return f"Confirm slot {payload.get('slot_id')}."
    if action == "confirm_booking":
        return "Confirm booking."
    if action == "compare_periods":
        return f"Compare {payload.get('period_a')} vs {payload.get('period_b')}."
    if action == "view_earnings":
        return f"Earnings year={payload.get('year')} month={payload.get('month')}."
    return f"Action {action}"


def _shrink_tool_response(response: Any, max_chars: int = 400) -> Any:
    if response is None:
        return response
    if isinstance(response, list) and response and isinstance(response[0], dict):
        slim = [
            {k: item[k] for k in ("id", "name", "city", "avg_rating", "status") if k in item}
            for item in response
        ]
        text = json.dumps(slim, default=str)
        if len(text) <= max_chars:
            return slim
        return slim[:5]
    text = json.dumps(response, default=str) if not isinstance(response, str) else response
    if len(text) <= max_chars:
        return response
    if isinstance(response, list):
        return {"_truncated": True, "count": len(response)}
    if isinstance(response, dict):
        return {"_truncated": True, "keys": list(response.keys())[:8]}
    return str(response)[:max_chars]


def _shrink_event_payloads(event) -> None:
    if not event.content or not event.content.parts:
        return
    for part in event.content.parts:
        fr = part.function_response
        if fr and fr.response is not None:
            fr.response = _shrink_tool_response(fr.response)
        if part.text and len(part.text) > 600:
            parsed = parse_json_message(part.text)
            if parsed:
                part.text = json.dumps({"message": parsed.message})


def _compact_session_history(user_id: str, session_id: str) -> None:
    """Trim ADK session events so later turns don't replay huge tool payloads."""
    max_events = settings.agent_session_max_events
    store = _session_service.sessions.get(APP_NAME, {}).get(user_id, {}).get(session_id)
    if not store or not store.events:
        return

    for event in store.events[:-3]:
        _shrink_event_payloads(event)

    if len(store.events) > max_events:
        store.events = store.events[-max_events:]


async def _run_llm_turn(
    *,
    role: str,
    user_id: str,
    session_id: str,
    user_text: str,
    model: str,
) -> tuple[str, list[UIBlock]]:
    runner = _get_runner(role, model)

    session = await _session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        await _session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
            state={"user_id": user_id, "user_role": role},
        )

    new_message = types.Content(role="user", parts=[types.Part(text=user_text)])
    collected_events = []

    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
        state_delta={"user_id": user_id, "user_role": role},
    ):
        collected_events.append(event)

    # Build UI from full tool payloads before session compaction shrinks them in-place.
    tool_blocks = build_ui_blocks_from_events(collected_events)
    structured = extract_structured_from_events(collected_events)

    _compact_session_history(user_id, session_id)
    if structured:
        return structured.message, merge_response_blocks(structured.ui_blocks, tool_blocks)

    fallback_text = "I couldn't complete that request. Please try again."
    for event in reversed(collected_events):
        if event.is_final_response():
            text = _extract_text_from_event(event)
            if text:
                parsed = parse_json_message(text)
                if parsed:
                    return parsed.message, merge_response_blocks(parsed.ui_blocks, tool_blocks)
                fallback_text = text
                break

    return fallback_text, tool_blocks


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

    if action:
        fast = await try_handle_action(
            role=role,
            user_id=user_id,
            action=action,
            payload=action_payload,
        )
        if fast:
            return session_id, fast[0], role, fast[1]

    if role == "customer" and not action and message.strip():
        fast_search = await try_handle_search_intent(message.strip())
        if fast_search:
            return session_id, fast_search[0], role, fast_search[1]

    user_text = message.strip()
    if action:
        user_text = _action_to_message(action, action_payload)
    if not user_text:
        user_text = "Hello"

    last_error: Exception | None = None
    for model in _models_to_try():
        try:
            reply, ui_blocks = await _run_llm_turn(
                role=role,
                user_id=user_id,
                session_id=session_id,
                user_text=user_text,
                model=model,
            )
            return session_id, reply, role, ui_blocks
        except Exception as exc:
            if not _is_retryable_llm_error(exc):
                logger.exception("Agent LLM error (non-retryable) model=%s", model)
                raise AgentLlmError(
                    "Something went wrong with the AI service. Please try again."
                ) from exc
            last_error = exc
            logger.warning("Model %s unavailable (%s), trying next", model, exc)

    logger.error("All LLM models failed: %s", last_error)
    raise AgentLlmError()
