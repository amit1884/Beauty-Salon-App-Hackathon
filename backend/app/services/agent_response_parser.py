"""Parse ADK agent output into structured chat responses."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.schemas.agent import AgentChatResponse, UIBlock

logger = logging.getLogger(__name__)


def _unwrap_payload(data: Any) -> Any:
    if isinstance(data, str):
        text = data.strip()
        if text.startswith("{") or text.startswith("["):
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                return data
        else:
            return data
    if isinstance(data, dict):
        if "result" in data and isinstance(data["result"], dict):
            return data["result"]
        if "response" in data and isinstance(data["response"], dict) and "message" in data["response"]:
            return data["response"]
    return data


def parse_agent_response(data: Any) -> AgentChatResponse | None:
    """Normalize ADK / Gemini payloads into AgentChatResponse."""
    payload = _unwrap_payload(data)
    if not isinstance(payload, dict) or "message" not in payload:
        return None
    try:
        blocks = payload.get("ui_blocks") or []
        normalized_blocks = []
        for block in blocks:
            if isinstance(block, dict):
                normalized_blocks.append(
                    UIBlock(
                        type=block.get("type", "text"),
                        title=block.get("title"),
                        data=block.get("data") or {},
                        actions=block.get("actions") or [],
                    )
                )
        return AgentChatResponse(message=str(payload["message"]), ui_blocks=normalized_blocks)
    except Exception as exc:
        logger.warning("Failed to parse agent response: %s", exc)
        return None


def parse_json_message(text: str) -> AgentChatResponse | None:
    if not text or not text.strip().startswith("{"):
        return None
    raw = text.strip()
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()
    try:
        return parse_agent_response(json.loads(raw))
    except json.JSONDecodeError:
        return parse_agent_response(raw)


def extract_structured_from_events(events) -> AgentChatResponse | None:
    """Extract structured chat response from ADK runner events."""
    for event in reversed(list(events)):
        # set_model_response tool result
        if event.content and event.content.parts:
            for part in event.content.parts:
                fr = part.function_response
                if fr and fr.name == "set_model_response" and fr.response is not None:
                    parsed = parse_agent_response(fr.response)
                    if parsed:
                        return parsed

        # ADK may attach structured output on actions
        actions = getattr(event, "actions", None)
        if actions is not None:
            smr = getattr(actions, "set_model_response", None)
            if smr:
                parsed = parse_agent_response(smr)
                if parsed:
                    return parsed

        # Final model text may be JSON from output_schema processor
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    parsed = parse_json_message(part.text)
                    if parsed:
                        return parsed

    return None
