import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Search, Navigation, SlidersHorizontal } from 'lucide-react';
import { api, type Salon } from '../lib/api';
import SalonCard from '../components/SalonCard';
import { SalonCardSkeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { cn, SERVICE_CATEGORIES } from '../lib/utils';

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const city = searchParams.get('city') ?? '';
  const category = searchParams.get('category') ?? '';

  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [usingLocation, setUsingLocation] = useState(false);
  const [localCity, setLocalCity] = useState(city);

  useEffect(() => {
    setLocalCity(city);
  }, [city]);

  const runSearch = useCallback(async (opts: { city?: string; category?: string; geo?: boolean }) => {
    setLoading(true);
    setError('');
    const q = opts.city ?? '';
    const cat = opts.category ?? category;

    try {
      const params: Record<string, string | number> = {};
      if (q) params.city = q;
      if (cat) params.service_type = cat;

      if (opts.geo && navigator.geolocation) {
        setUsingLocation(true);
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const data = await api.listSalons({
                ...params,
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                radius_km: 20,
              });
              setSalons(data);
            } catch {
              setError('Could not load nearby salons');
            } finally {
              setLoading(false);
            }
          },
          () => {
            setUsingLocation(false);
            api.listSalons(params)
              .then(setSalons)
              .catch(() => setError('Failed to load salons'))
              .finally(() => setLoading(false));
          },
        );
        return;
      }

      setUsingLocation(false);
      const data = await api.listSalons(params);
      setSalons(data);
    } catch {
      setError('Failed to load salons');
    } finally {
      if (!opts.geo) setLoading(false);
    }
  }, [category]);

  // Run search when URL params change (including from top bar)
  useEffect(() => {
    if (city) {
      runSearch({ city, category });
    } else {
      runSearch({ geo: true, category });
    }
  }, [city, category, runSearch]);

  const applyCitySearch = () => {
    const params = new URLSearchParams(searchParams);
    const trimmed = localCity.trim();
    if (trimmed) params.set('city', trimmed);
    else params.delete('city');
    setSearchParams(params);
  };

  const applyCategory = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('category', value);
    else params.delete('category');
    setSearchParams(params);
  };

  const findNearMe = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('city');
    setSearchParams(params);
    runSearch({ geo: true, category });
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-700 via-brand-600 to-brand-800 p-8 md:p-10 text-white"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-400/20 rounded-full translate-y-1/2 -translate-x-1/4 animate-float" />

        <div className="relative z-10 max-w-xl">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-brand-200 text-sm font-medium tracking-widest uppercase mb-2"
          >
            Beauty & Wellness
          </motion.p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold leading-tight">
            Discover salons<br />you&apos;ll love
          </h2>
          <p className="mt-3 text-white/70 text-sm md:text-base leading-relaxed">
            Book haircuts, facials, bridal makeup and more — at top-rated salons near you.
          </p>
        </div>
      </motion.section>

      {/* Search — synced with top bar via URL params */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300 transition-all shadow-sm"
              placeholder="Search city or area (e.g. Mumbai)"
              value={localCity}
              onChange={(e) => setLocalCity(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCitySearch()}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyCitySearch} className="flex-1 sm:flex-none">
              <Search className="w-4 h-4" /> Search
            </Button>
            <Button
              variant="outline"
              onClick={findNearMe}
              className="bg-white"
              title="Use my location"
            >
              <Navigation className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => applyCategory(cat.value)}
              className={cn(
                'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                category === cat.value
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-brand-300 hover:text-brand-600',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* Results header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">
            {usingLocation && !city ? 'Salons near you' : city ? `Salons in ${city}` : 'Featured salons'}
          </h3>
          {!loading && (
            <p className="text-sm text-stone-500 mt-0.5">{salons.length} salon{salons.length !== 1 ? 's' : ''} found</p>
          )}
        </div>
        <SlidersHorizontal className="w-5 h-5 text-stone-400" />
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Salon grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SalonCardSkeleton key={i} />)
          : salons.map((salon, i) => <SalonCard key={salon.id} salon={salon} index={i} />)
        }
      </div>

      {!loading && salons.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 px-6 rounded-3xl bg-white border border-stone-100"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-brand-400" />
          </div>
          <h3 className="font-display text-xl font-semibold text-stone-800">No salons found</h3>
          <p className="text-stone-500 text-sm mt-2 max-w-sm mx-auto">
            Try a different city or category, or use your location to find nearby salons.
          </p>
          <Button className="mt-6" onClick={findNearMe}>
            <Navigation className="w-4 h-4" /> Find near me
          </Button>
        </motion.div>
      )}
    </div>
  );
}
