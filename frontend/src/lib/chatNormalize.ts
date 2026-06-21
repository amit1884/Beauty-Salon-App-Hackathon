import type { ChatResponse, ChatUIBlock, ChatActionPayload } from '../lib/api';

/** Human-readable bubble text when user taps a generative UI action. */
export function formatActionUserMessage(
  action: string,
  payload: ChatActionPayload = {},
  label?: string,
): string {
  if (label?.trim()) return label.trim();

  const name = payload.name != null ? String(payload.name) : '';
  const price = payload.service_price ?? payload.price;
  const date = payload.slot_date != null ? String(payload.slot_date) : '';
  const time = payload.slot_time != null ? String(payload.slot_time) : '';

  switch (action) {
    case 'select_salon':
      return name ? `Selected salon: ${name}` : 'Selected a salon';
    case 'select_service':
      return name && price != null ? `Selected service: ${name} (₹${price})` : name ? `Selected service: ${name}` : 'Selected a service';
    case 'select_slot':
      return date && time ? `Selected slot: ${date} at ${time}` : date ? `Selected slot: ${date}` : 'Selected a time slot';
    case 'confirm_booking':
      return name ? `Confirm booking at ${name}` : 'Confirm booking';
    case 'compare_periods':
      return `Compare ${payload.period_a ?? ''} vs ${payload.period_b ?? ''}`.trim();
    case 'view_earnings':
      if (payload.year && payload.month) return `Show earnings for ${payload.year}-${payload.month}`;
      if (payload.year) return `Show earnings for ${payload.year}`;
      return 'Show my earnings';
    default:
      return 'Continue';
  }
}

/** If the API returns JSON in message text, split it into message + ui_blocks. */
export function normalizeChatResponse(res: ChatResponse): ChatResponse {
  if (res.ui_blocks?.length) return res;

  const text = res.message?.trim() ?? '';
  if (!text.startsWith('{')) return res;

  try {
    let raw = text;
    if (raw.includes('```json')) {
      raw = raw.split('```json')[1].split('```')[0].trim();
    } else if (raw.includes('```')) {
      raw = raw.split('```')[1].split('```')[0].trim();
    }
    const parsed = JSON.parse(raw) as { message?: string; ui_blocks?: ChatUIBlock[] };
    if (parsed.message) {
      return {
        ...res,
        message: parsed.message,
        ui_blocks: parsed.ui_blocks ?? [],
      };
    }
  } catch {
    // keep original
  }

  return res;
}
