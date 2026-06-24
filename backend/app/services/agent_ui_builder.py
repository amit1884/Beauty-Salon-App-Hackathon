"""Build generative UI blocks from tool results — keeps LLM output small."""

from __future__ import annotations

from typing import Any

from app.schemas.agent import UIBlock


def _unwrap_tool_payload(response: Any) -> Any:
    """ADK wraps function tool returns as {\"result\": ...}."""
    if isinstance(response, dict) and "result" in response:
        return response["result"]
    return response


def _tool_results_from_events(events) -> dict[str, Any]:
    """Last tool response per name in this turn, plus call args."""
    results: dict[str, Any] = {}
    call_args: dict[str, dict[str, Any]] = {}
    for event in events:
        if not event.content or not event.content.parts:
            continue
        for part in event.content.parts:
            fc = part.function_call
            if fc and fc.name:
                call_args[fc.name] = dict(fc.args or {})
            fr = part.function_response
            if fr and fr.name and fr.name != "set_model_response":
                results[fr.name] = _unwrap_tool_payload(fr.response)
    results["_call_args"] = call_args
    return results


def _salon_list_block(salons: list[dict[str, Any]], *, title: str = "Salons") -> UIBlock | None:
    if not salons:
        return None
    return UIBlock(type="salon_list", title=title, data={"salons": salons})


def build_ui_blocks_from_tool_results(tool_results: dict[str, Any]) -> list[UIBlock]:
    blocks: list[UIBlock] = []
    tool_results = dict(tool_results)
    call_args = tool_results.pop("_call_args", {})

    if "compare_owner_earnings" in tool_results:
        data = tool_results["compare_owner_earnings"]
        if isinstance(data, dict) and "period_a" in data:
            blocks.append(UIBlock(type="comparison_chart", title="Earnings comparison", data=data))
            return blocks

    if "get_owner_earnings" in tool_results:
        data = tool_results["get_owner_earnings"]
        if isinstance(data, dict) and data.get("by_month"):
            blocks.append(UIBlock(type="earnings_chart", title="Earnings", data=data))
            return blocks

    if "get_platform_analytics" in tool_results:
        data = tool_results["get_platform_analytics"]
        if isinstance(data, dict):
            summary = {k: v for k, v in data.items() if k != "monthly_trends"}
            blocks.append(UIBlock(type="analytics_summary", title="Platform overview", data=summary))
            return blocks

    if "list_top_clients" in tool_results:
        clients = tool_results["list_top_clients"]
        if isinstance(clients, list) and clients:
            blocks.append(UIBlock(type="client_list", title="Top clients", data={"clients": clients}))
            return blocks

    if "list_salons_admin" in tool_results:
        salons = tool_results["list_salons_admin"]
        if isinstance(salons, list) and salons:
            blocks.append(_salon_list_block(salons, title="Salons") or UIBlock(type="text", data={}))
            return blocks

    if "list_available_slots" in tool_results:
        slots = _unwrap_tool_payload(tool_results["list_available_slots"])
        slot_args = call_args.get("list_available_slots", {})
        if isinstance(slots, list) and slots:
            blocks.append(
                UIBlock(
                    type="slot_picker",
                    title="Available slots",
                    data={
                        "slots": slots,
                        "salon_id": slot_args.get("salon_id", ""),
                        "service_id": slot_args.get("service_id", ""),
                    },
                )
            )
            return blocks

    if "get_salon_details" in tool_results:
        salon = _unwrap_tool_payload(tool_results["get_salon_details"])
        if isinstance(salon, dict) and salon.get("services"):
            blocks.append(
                UIBlock(
                    type="service_picker",
                    title=salon.get("name", "Services"),
                    data={"salon_id": salon.get("id"), "services": salon["services"]},
                )
            )
            return blocks

    if "search_salons" in tool_results:
        salons = _unwrap_tool_payload(tool_results["search_salons"])
        if isinstance(salons, list) and salons:
            block = _salon_list_block(salons)
            if block:
                blocks.append(block)
            return blocks

    return blocks


def build_ui_blocks_from_events(events) -> list[UIBlock]:
    return build_ui_blocks_from_tool_results(_tool_results_from_events(events))


def merge_response_blocks(model_blocks: list[UIBlock], tool_blocks: list[UIBlock]) -> list[UIBlock]:
    """Prefer server-built blocks; fall back to model blocks if tools produced nothing."""
    return tool_blocks if tool_blocks else model_blocks
