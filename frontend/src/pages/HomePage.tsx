import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Navigation, Search, SlidersHorizontal } from 'lucide-react';
import { api, type Salon } from '../lib/api';
import SalonCard from '../components/SalonCard';
import { SalonCardSkeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { useSelectedCity } from '../hooks/useSelectedCity';
import { cn, SERVICE_CATEGORIES } from '../lib/utils';

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { city, detecting } = useSelectedCity();
  const category = searchParams.get('category') ?? '';

  const [salons, setSalons] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const runSearch = useCallback(async (opts: { city: string; category?: string }) => {
    setLoading(true);
    setError('');
    const cat = opts.category ?? category;

    try {
      const params: Record<string, string> = { city: opts.city };
      if (cat) params.service_type = cat;
      const data = await api.listSalons(params);
      setSalons(data);
    } catch {
      setError('Failed to load salons');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    if (!city) return;
    runSearch({ city, category });
  }, [city, category, runSearch]);

  const applyCategory = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set('category', value);
    else params.delete('category');
    setSearchParams(params);
  };

  const isLoading = detecting || (!city && loading) || (city && loading);

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

      {/* Category filters */}
      <section>
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
            {detecting || !city
              ? 'Finding salons near you'
              : `Salons in ${city}`}
          </h3>
          {!isLoading && city && (
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
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <SalonCardSkeleton key={i} />)
          : salons.map((salon, i) => <SalonCard key={salon.id} salon={salon} index={i} />)
        }
      </div>

      {!isLoading && city && salons.length === 0 && !error && (
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
            Try a different city from the top bar or pick another category.
          </p>
          <Button className="mt-6" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Navigation className="w-4 h-4" /> Change city
          </Button>
        </motion.div>
      )}
    </div>
  );
}
