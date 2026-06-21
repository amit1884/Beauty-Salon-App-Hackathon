"""Google ADK agents for SalonBook role-based chat."""

from __future__ import annotations

from google.adk.agents.llm_agent import Agent

from app.agents.salon_function_tools import ADMIN_TOOLS, CUSTOMER_TOOLS, OWNER_TOOLS
from app.config import settings
from app.schemas.agent import AgentChatResponse

LLM_MODEL = settings.llm_model

CUSTOMER_INSTRUCTION = """You are SalonBook Assistant for customers in India.
Help users discover salons, check services, view available slots, and book appointments.

Always use your tools to fetch real data — never invent salon names or prices.
When showing salons, include a salon_list ui_block with a "salons" array in data (each salon must include id, name, city, address).
When showing services, use service_picker with services array and salon_id in data.
When showing slots, use slot_picker with slots array and salon_id, service_id in data.

The authenticated user is a customer. Tools use their session automatically.
Respond via set_model_response with message + ui_blocks.
Keep replies concise and helpful."""

OWNER_INSTRUCTION = """You are SalonBook Assistant for salon owners.
Help owners register salons, add services, view earnings, and compare performance across months/years.

Use your tools for all data. For earnings, include earnings_chart ui_blocks.
For period comparisons, include comparison_chart ui_blocks with period_a, period_b data.
For salon creation, guide step-by-step and use create_salon tool when details are complete.

Respond via set_model_response with message + ui_blocks."""

ADMIN_INSTRUCTION = """You are SalonBook Admin Assistant.
Help admins monitor platform health, track clients, review pending salons, and analyze trends.

Use your tools for analytics and client lists. Include analytics_summary and client_list ui_blocks.
For pending salons, use list_salons_admin with status=pending.

Respond via set_model_response with message + ui_blocks."""


def build_customer_agent() -> Agent:
    return Agent(
        model=LLM_MODEL,
        name="salonbook_customer_agent",
        description="Customer booking and enquiry assistant",
        instruction=CUSTOMER_INSTRUCTION,
        mode="chat",
        output_schema=AgentChatResponse,
        tools=CUSTOMER_TOOLS,
    )


def build_owner_agent() -> Agent:
    return Agent(
        model=LLM_MODEL,
        name="salonbook_owner_agent",
        description="Owner salon and earnings assistant",
        instruction=OWNER_INSTRUCTION,
        mode="chat",
        output_schema=AgentChatResponse,
        tools=OWNER_TOOLS,
    )


def build_admin_agent() -> Agent:
    return Agent(
        model=LLM_MODEL,
        name="salonbook_admin_agent",
        description="Admin analytics and client tracking assistant",
        instruction=ADMIN_INSTRUCTION,
        mode="chat",
        output_schema=AgentChatResponse,
        tools=ADMIN_TOOLS,
    )


def agent_for_role(role: str) -> Agent:
    if role == "owner":
        return build_owner_agent()
    if role == "admin":
        return build_admin_agent()
    return build_customer_agent()
