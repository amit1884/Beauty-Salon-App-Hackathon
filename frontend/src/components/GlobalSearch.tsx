import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import { cn } from '../lib/utils';

interface GlobalSearchProps {
  className?: string;
  compact?: boolean;
}

export default function GlobalSearch({ className, compact }: GlobalSearchProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const cityParam = searchParams.get('city') ?? '';
  const [query, setQuery] = useState(cityParam);

  useEffect(() => {
    setQuery(cityParam);
  }, [cityParam]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = query.trim();

    if (location.pathname === '/') {
      const params = new URLSearchParams(searchParams);
      if (trimmed) params.set('city', trimmed);
      else params.delete('city');
      navigate({ pathname: '/', search: params.toString() ? `?${params}` : '' }, { replace: false });
    } else {
      navigate(trimmed ? `/?city=${encodeURIComponent(trimmed)}` : '/');
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        'flex items-center gap-2 rounded-2xl border border-stone-200 bg-white shadow-sm transition-all',
        'focus-within:ring-2 focus-within:ring-brand-300 focus-within:border-brand-300',
        compact ? 'flex-1 px-3 py-2' : 'w-full max-w-md px-4 py-2.5',
        className,
      )}
    >
      {compact ? (
        <Search className="w-4 h-4 text-stone-400 shrink-0" />
      ) : (
        <MapPin className="w-4 h-4 text-brand-500 shrink-0" />
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search city or area (e.g. Mumbai)"
        className="flex-1 bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none min-w-0"
        aria-label="Search salons by city or area"
      />
      {!compact && (
        <button
          type="submit"
          className="shrink-0 px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 transition-colors"
        >
          Search
        </button>
      )}
    </form>
  );
}
