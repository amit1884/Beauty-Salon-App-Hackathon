import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Star, ChevronRight, Sparkles } from 'lucide-react';
import type { Salon } from '../lib/api';
import { cn, formatPrice, salonGradient } from '../lib/utils';

interface SalonCardProps {
  salon: Salon;
  index?: number;
}

export default function SalonCard({ salon, index = 0 }: SalonCardProps) {
  const gradient = salonGradient(salon.name);
  const minPrice = salon.services?.length
    ? Math.min(...salon.services.map((s: { price: number }) => s.price))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
    >
      <Link to={`/salons/${salon.id}`} className="group block">
        <article className="relative overflow-hidden rounded-2xl bg-white border border-stone-100/80 shadow-sm hover:shadow-xl hover:shadow-brand-600/10 transition-all duration-300 hover:-translate-y-1">
          <div className={cn('relative h-44 bg-linear-to-br overflow-hidden', gradient)}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
            <div className="absolute top-3 right-3">
              {salon.avg_rating != null ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-sm font-semibold text-stone-800 shadow-sm">
                  <Star className="w-3.5 h-3.5 fill-gold-400 text-gold-400" />
                  {salon.avg_rating}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-xs font-medium text-brand-600">
                  <Sparkles className="w-3 h-3" /> New
                </span>
              )}
            </div>
            <div className="absolute bottom-0 inset-x-0 p-4 bg-linear-to-t from-black/50 to-transparent">
              <h3 className="font-display text-2xl font-semibold text-white tracking-wide">{salon.name}</h3>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-start gap-2 text-stone-500 text-sm">
              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{salon.address}, {salon.city}</span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                {salon.distance_km != null && (
                  <span className="text-brand-600 font-medium">{salon.distance_km} km away</span>
                )}
                {salon.review_count > 0 && (
                  <span className="text-stone-400">{salon.review_count} reviews</span>
                )}
                {minPrice != null && (
                  <span className="text-stone-600">From {formatPrice(minPrice)}</span>
                )}
              </div>
              <span className="flex items-center gap-0.5 text-brand-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                View <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}
