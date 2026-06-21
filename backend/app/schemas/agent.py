"""Pydantic schemas for agent chat responses."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


UIBlockType = Literal[
    "text",
    "salon_list",
    "slot_picker",
    "service_picker",
    "booking_summary",
    "earnings_chart",
    "comparison_chart",
    "analytics_summary",
    "client_list",
    "actions",
]


class ChatAction(BaseModel):
    label: str
    action: str
    payload: dict[str, Any] = Field(default_factory=dict)


class UIBlock(BaseModel):
    type: UIBlockType
    title: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    actions: list[ChatAction] = Field(default_factory=list)


class AgentChatResponse(BaseModel):
    message: str = Field(description="Friendly conversational reply for the user")
    ui_blocks: list[UIBlock] = Field(
        default_factory=list,
        description="Interactive UI blocks the frontend renders (salon cards, charts, buttons)",
    )


class ChatRequest(BaseModel):
    message: str = ""
    session_id: str | None = None
    action: str | None = None
    action_payload: dict[str, Any] | None = None


class ChatResponse(BaseModel):
    session_id: str
    message: str
    ui_blocks: list[UIBlock]
    role: str
