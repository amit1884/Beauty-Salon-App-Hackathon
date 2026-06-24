import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, Loader2, MapPin, Navigation, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useSelectedCity } from '../hooks/useSelectedCity';
import { cn } from '../lib/utils';

interface CitySelectorProps {
  className?: string;
}

export default function CitySelector({ className }: CitySelectorProps) {
  const { city, setCity, detecting, detectAndSetCity } = useSelectedCity();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || cities.length > 0) return;
    setLoadingCities(true);
    api
      .listSalons({})
      .then((salons) => {
        const unique = [...new Set(salons.map((s) => s.city))].sort();
        setCities(unique);
      })
      .catch(() => setCities([]))
      .finally(() => setLoadingCities(false));
  }, [open, cities.length]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const subtitle = detecting
    ? 'Locating…'
    : city || 'Select city';

  const trimmedQuery = query.trim();
  const filteredCities = trimmedQuery
    ? cities.filter((c) => c.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : cities;
  const hasExactMatch = trimmedQuery
    ? cities.some((c) => c.toLowerCase() === trimmedQuery.toLowerCase())
    : false;

  const selectCity = (value: string) => {
    setCity(value, { navigateHome: true });
    setOpen(false);
    setQuery('');
  };

  const submitSearch = (e?: FormEvent) => {
    e?.preventDefault();
    if (!trimmedQuery) return;
    selectCity(trimmedQuery);
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group text-left rounded-xl px-1 py-0.5 transition-colors',
          'hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select city"
      >
        <div className="border-b-2 border-amber-400 pb-1.5 pr-6 relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-900 leading-none">
            Select city
          </p>
          <p className="mt-1 text-lg font-semibold text-stone-900 leading-tight flex items-center gap-1.5">
            {detecting && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
            <span className="truncate max-w-[200px] sm:max-w-[280px]">{subtitle}</span>
          </p>
          <ChevronDown
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 transition-transform',
              open && 'rotate-180',
            )}
          />
        </div>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full mt-2 z-50 w-72 rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-200/50 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void detectAndSetCity();
            }}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-50 border-b border-stone-100 transition-colors"
          >
            <Navigation className="w-4 h-4 shrink-0" />
            Use my location
          </button>

          <form onSubmit={submitSearch} className="p-3 border-b border-stone-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city (e.g. Mumbai, Pune)"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300"
                aria-label="Search city"
              />
            </div>
          </form>

          <div className="max-h-56 overflow-y-auto py-1">
            {loadingCities ? (
              <p className="px-4 py-3 text-sm text-stone-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading cities…
              </p>
            ) : (
              <>
                {trimmedQuery && !hasExactMatch && (
                  <button
                    type="button"
                    onClick={() => selectCity(trimmedQuery)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left text-brand-700 font-medium hover:bg-brand-50 transition-colors border-b border-stone-50"
                  >
                    <Search className="w-3.5 h-3.5 shrink-0" />
                    Search in &ldquo;{trimmedQuery}&rdquo;
                  </button>
                )}

                {filteredCities.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="option"
                    aria-selected={c === city}
                    onClick={() => selectCity(c)}
                    className={cn(
                      'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors',
                      c === city
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-stone-700 hover:bg-stone-50',
                    )}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                    {c}
                  </button>
                ))}

                {!trimmedQuery && cities.length === 0 && (
                  <p className="px-4 py-3 text-sm text-stone-400">Type a city name to search</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
