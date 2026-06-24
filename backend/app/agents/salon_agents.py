"""Google ADK agents for SalonBook role-based chat."""

from __future__ import annotations

from google.adk.agents.llm_agent import Agent

from app.agents.salon_function_tools import ADMIN_TOOLS, CUSTOMER_TOOLS, OWNER_TOOLS
from app.config import settings
from app.schemas.agent import AgentModelOutput

_BASE = (
    "SalonBook assistant for India. Use tools for real data — never invent salons or prices. "
    "Reply using the output schema: a short message field only (max 2 sentences). "
    "Do not include ui_blocks; the server builds UI from tool results."
)

CUSTOMER_INSTRUCTION = (
    _BASE
    + " Help customers find salons, view services/slots, and book. "
    "When the user names a city, call search_salons with that city (e.g. Mumbai). "
    "Tools use their session automatically."
)

OWNER_INSTRUCTION = (
    _BASE
    + " Help owners manage salons, services, and earnings. Guide salon setup step-by-step before calling create_salon."
)

ADMIN_INSTRUCTION = (
    _BASE
    + " Help admins review pending salons, view analytics, and list top clients."
)


def agent_for_role(role: str, *, model: str | None = None) -> Agent:
    llm_model = model or settings.llm_model
    if role == "owner":
        return Agent(
            model=llm_model,
            name="salonbook_owner_agent",
            description="Owner salon and earnings assistant",
            instruction=OWNER_INSTRUCTION,
            mode="chat",
            output_schema=AgentModelOutput,
            tools=OWNER_TOOLS,
        )
    if role == "admin":
        return Agent(
            model=llm_model,
            name="salonbook_admin_agent",
            description="Admin analytics assistant",
            instruction=ADMIN_INSTRUCTION,
            mode="chat",
            output_schema=AgentModelOutput,
            tools=ADMIN_TOOLS,
        )
    return Agent(
        model=llm_model,
        name="salonbook_customer_agent",
        description="Customer booking assistant",
        instruction=CUSTOMER_INSTRUCTION,
        mode="chat",
        output_schema=AgentModelOutput,
        tools=CUSTOMER_TOOLS,
    )
