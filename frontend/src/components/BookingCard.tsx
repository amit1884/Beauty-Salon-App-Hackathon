import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Scissors, CreditCard, User } from 'lucide-react';
import type { Booking } from '../lib/api';
import Badge from './ui/Badge';
import { cn, formatDate, formatPrice, formatTime, salonGradient } from '../lib/utils';

interface BookingCardProps {
  booking: Booking;
  index?: number;
  ownerView?: boolean;
}

const statusConfig = {
  confirmed: { label: 'Confirmed', variant: 'success' as const },
  pending: { label: 'Pending', variant: 'warning' as const },
  cancelled: { label: 'Cancelled', variant: 'muted' as const },
  completed: { label: 'Completed', variant: 'default' as const },
};

const paymentConfig = {
  paid: { label: 'Paid', variant: 'success' as const },
  unpaid: { label: 'Pay at salon', variant: 'warning' as const },
  refunded: { label: 'Refunded', variant: 'muted' as const },
};

export default function BookingCard({ booking, index = 0, ownerView }: BookingCardProps) {
  const gradient = salonGradient(booking.salon_name);
  const status = statusConfig[booking.status as keyof typeof statusConfig] ?? statusConfig.pending;
  const payment = paymentConfig[booking.payment_status as keyof typeof paymentConfig] ?? paymentConfig.unpaid;

  return (
    <motion.article
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35 }}
      className="group relative overflow-hidden rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className={cn('h-1.5 bg-linear-to-r', gradient)} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            {ownerView && booking.customer_name ? (
              <>
                <p className="font-display text-xl font-semibold text-stone-900">{booking.customer_name}</p>
                <p className="text-sm text-stone-500 mt-0.5">{booking.service_name}</p>
              </>
            ) : (
              <>
                <Link
                  to={`/salons/${booking.salon_id}`}
                  className="font-display text-xl font-semibold text-stone-900 hover:text-brand-600 transition-colors"
                >
                  {booking.salon_name}
                </Link>
                <div className="flex items-center gap-1.5 mt-1 text-sm text-stone-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {booking.salon_city}
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant={payment.variant}>{payment.label}</Badge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {!ownerView && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50">
              <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
                <Scissors className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <p className="text-xs text-stone-400">Service</p>
                <p className="text-sm font-medium text-stone-800">{booking.service_name}</p>
              </div>
            </div>
          )}

          {ownerView && booking.customer_name && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 col-span-2">
              <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
                <User className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <p className="text-xs text-stone-400">Customer</p>
                <p className="text-sm font-medium text-stone-800">{booking.customer_name}</p>
              </div>
            </div>
          )}

          {ownerView && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 col-span-2 sm:col-span-1">
              <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
                <Scissors className="w-4 h-4 text-brand-600" />
              </div>
              <div>
                <p className="text-xs text-stone-400">Service</p>
                <p className="text-sm font-medium text-stone-800">{booking.service_name}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50">
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-stone-400">Price</p>
              <p className="text-sm font-medium text-stone-800">{formatPrice(booking.service_price)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50">
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-stone-400">Date</p>
              <p className="text-sm font-medium text-stone-800">{formatDate(booking.slot_date)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50">
            <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-stone-400">Time</p>
              <p className="text-sm font-medium text-stone-800">{formatTime(booking.slot_time)}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
