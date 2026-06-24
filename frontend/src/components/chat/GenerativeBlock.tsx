import { Calendar, MapPin, Star, TrendingDown, TrendingUp } from 'lucide-react';
import type { ChatActionPayload, ChatUIBlock } from '../../lib/api';

interface Props {
  block: ChatUIBlock;
  onAction: (action: string, payload: ChatActionPayload, label?: string) => void;
  disabled?: boolean;
}

function ActionButtons({
  actions,
  onAction,
  disabled,
}: {
  actions: ChatUIBlock['actions'];
  onAction: Props['onAction'];
  disabled?: boolean;
}) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((a, i) => (
        <button
          key={`${a.action}-${i}`}
          type="button"
          disabled={disabled}
          onClick={() => onAction(a.action, a.payload ?? {}, a.label)}
          className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function formatInr(value: number): string {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

type PeriodStat = { period: string; earnings: number; bookings: number };

function ComparisonBarChart({
  periodA,
  periodB,
  delta,
  pct,
}: {
  periodA: PeriodStat;
  periodB: PeriodStat;
  delta?: number;
  pct?: number | null;
}) {
  const max = Math.max(periodA.earnings, periodB.earnings, 1);
  const periods = [periodA, periodB];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-center gap-6 sm:gap-10 h-44 px-2">
        {periods.map((p, index) => {
          const heightPct = Math.max(8, (p.earnings / max) * 100);
          const isSecond = index === 1;
          return (
            <div key={p.period} className="flex flex-col items-center gap-2 flex-1 max-w-[120px]">
              <span className="text-xs font-semibold text-stone-700">₹{formatInr(p.earnings)}</span>
              <div className="w-full flex items-end justify-center h-28">
                <div
                  className={`w-14 sm:w-16 rounded-t-lg transition-all ${
                    isSecond ? 'bg-brand-500' : 'bg-brand-300'
                  }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${p.period}: ₹${formatInr(p.earnings)}`}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-stone-800">{p.period}</p>
                <p className="text-[11px] text-stone-500">{p.bookings} bookings</p>
              </div>
            </div>
          );
        })}
      </div>
      {delta != null && (
        <p
          className={`text-sm flex items-center justify-center gap-1 ${
            delta >= 0 ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {delta >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          ₹{formatInr(Math.abs(delta))} ({pct != null ? `${pct}%` : '—'}) vs prior period
        </p>
      )}
    </div>
  );
}

function EarningsTrendChart({
  rows,
}: {
  rows: Array<{ period: string; earnings: number; bookings: number }>;
}) {
  const max = Math.max(...rows.map((r) => r.earnings), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.period} className="flex items-center gap-3">
          <span className="text-xs text-stone-500 w-16 shrink-0">{row.period}</span>
          <div className="flex-1 h-7 bg-stone-100 rounded-md overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-md min-w-[4px]"
              style={{ width: `${Math.max(4, (row.earnings / max) * 100)}%` }}
            />
          </div>
          <span className="text-sm font-medium w-20 text-right shrink-0">₹{formatInr(row.earnings)}</span>
        </div>
      ))}
    </div>
  );
}

export default function GenerativeBlock({ block, onAction, disabled }: Props) {
  const salons = (block.data.salons as Array<Record<string, unknown>>) ?? block.data.items as Array<Record<string, unknown>> ?? [];
  const slots = (block.data.slots as Array<Record<string, unknown>>) ?? [];
  const services = (block.data.services as Array<Record<string, unknown>>) ?? [];

  if (block.type === 'salon_list') {
    const list = salons.length ? salons : [block.data];
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3">
        {block.title && <h3 className="font-medium text-stone-900">{block.title}</h3>}
        {list.filter((s) => s.id).map((salon) => (
          <div
            key={String(salon.id)}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100"
          >
            <div>
              <p className="font-medium text-stone-900">{String(salon.name)}</p>
              <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />
                {[salon.city, salon.address].filter((v) => v != null && v !== 'undefined' && String(v).trim()).join(' · ') || 'See details'}
              </p>
              {salon.avg_rating != null && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {String(salon.avg_rating)} ({String(salon.review_count ?? 0)} reviews)
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onAction(
                  'select_salon',
                  {
                    salon_id: String(salon.id),
                    name: String(salon.name),
                  },
                  `View & book ${String(salon.name)}`,
                )
              }
              className="text-sm px-3 py-1.5 rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-50"
            >
              View & book
            </button>
          </div>
        ))}
        <ActionButtons
          actions={block.actions?.filter((a) => a.action !== 'select_salon')}
          onAction={onAction}
          disabled={disabled}
        />
      </div>
    );
  }

  if (block.type === 'service_picker') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {block.title && <h3 className="font-medium mb-3">{block.title}</h3>}
        <div className="flex flex-col gap-2">
          {services.map((svc) => (
            <button
              key={String(svc.id)}
              type="button"
              disabled={disabled}
              onClick={() =>
                onAction(
                  'select_service',
                  {
                    service_id: String(svc.id),
                    salon_id: String(block.data.salon_id ?? ''),
                    name: String(svc.name),
                    price: Number(svc.price),
                  },
                  `${String(svc.name)} — ₹${String(svc.price)}`,
                )
              }
              className="flex w-full items-center justify-between gap-3 text-left p-3 rounded-xl border border-stone-100 hover:border-brand-200 hover:bg-brand-50/50 disabled:opacity-50"
            >
              <span className="font-medium">{String(svc.name)}</span>
              <span className="text-brand-600 shrink-0">₹{String(svc.price)}</span>
            </button>
          ))}
        </div>
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
      </div>
    );
  }

  if (block.type === 'slot_picker') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {block.title && <h3 className="font-medium mb-3">{block.title}</h3>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {slots.map((slot) => (
            <button
              key={String(slot.id)}
              type="button"
              disabled={disabled}
              onClick={() =>
                onAction(
                  'select_slot',
                  {
                    slot_id: String(slot.id),
                    salon_id: String(block.data.salon_id ?? ''),
                    service_id: String(block.data.service_id ?? ''),
                    slot_date: String(slot.slot_date),
                    slot_time: String(slot.slot_time),
                  },
                  `${String(slot.slot_date)} at ${String(slot.slot_time)}`,
                )
              }
              className="p-2 rounded-xl border border-stone-100 text-sm hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
            >
              <Calendar className="w-3.5 h-3.5 mx-auto mb-1 text-brand-600" />
              {String(slot.slot_date)}
              <br />
              <span className="font-medium">{String(slot.slot_time)}</span>
            </button>
          ))}
        </div>
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
      </div>
    );
  }

  if (block.type === 'booking_summary') {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-4">
        {block.title && <h3 className="font-medium mb-2">{block.title}</h3>}
        <dl className="text-sm space-y-1 text-stone-700">
          {Object.entries(block.data).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="capitalize text-stone-500">{k.replace(/_/g, ' ')}</dt>
              <dd className="font-medium">{String(v)}</dd>
            </div>
          ))}
        </dl>
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
        {!block.actions?.length && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction('confirm_booking', block.data as ChatActionPayload, 'Confirm booking')}
            className="mt-3 w-full py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            Confirm booking
          </button>
        )}
      </div>
    );
  }

  if (block.type === 'comparison_chart') {
    const periodA = block.data.period_a as PeriodStat | undefined;
    const periodB = block.data.period_b as PeriodStat | undefined;
    const delta = block.data.earnings_change as number | undefined;
    const pct = block.data.earnings_change_percent as number | null | undefined;

    if (!periodA || !periodB) return null;

    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {block.title && <h3 className="font-medium mb-4 text-stone-900">{block.title}</h3>}
        <ComparisonBarChart periodA={periodA} periodB={periodB} delta={delta} pct={pct} />
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
      </div>
    );
  }

  if (block.type === 'earnings_chart') {
    const byMonth = (block.data.by_month as Array<{ period: string; earnings: number; bookings: number }>) ?? [];
    const total = block.data.total_earnings as number | undefined;
    const count = block.data.booking_count as number | undefined;

    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        {block.title && <h3 className="font-medium mb-2 text-stone-900">{block.title}</h3>}
        {total != null && (
          <p className="text-sm text-stone-600 mb-4">
            Total ₹{formatInr(total)}
            {count != null ? ` · ${count} bookings` : ''}
          </p>
        )}
        {byMonth.length > 0 ? (
          <EarningsTrendChart rows={byMonth} />
        ) : (
          <p className="text-sm text-stone-500">No monthly breakdown for this period.</p>
        )}
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
      </div>
    );
  }

  if (block.type === 'analytics_summary') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 grid grid-cols-2 gap-3">
        {Object.entries(block.data).filter(([k]) => k !== 'monthly_trends').map(([k, v]) => (
          <div key={k} className="p-3 rounded-xl bg-stone-50">
            <p className="text-xs text-stone-500 capitalize">{k.replace(/_/g, ' ')}</p>
            <p className="text-lg font-semibold text-stone-900">{String(v)}</p>
          </div>
        ))}
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
      </div>
    );
  }

  if (block.type === 'client_list') {
    const clients = (block.data.clients as Array<Record<string, unknown>>) ?? [];
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        {block.title && <h3 className="font-medium mb-3">{block.title}</h3>}
        <ul className="divide-y divide-stone-100">
          {clients.map((c) => (
            <li key={String(c.id)} className="py-2 flex justify-between text-sm">
              <span>{String(c.name)} <span className="text-stone-400">({String(c.role)})</span></span>
              <span className="text-brand-600">{String(c.booking_count)} bookings</span>
            </li>
          ))}
        </ul>
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
      </div>
    );
  }

  if (block.type === 'actions') {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        {block.title && <p className="text-sm text-stone-600 mb-2">{block.title}</p>}
        <ActionButtons actions={block.actions} onAction={onAction} disabled={disabled} />
      </div>
    );
  }

  return null;
}
