import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, Search, Sparkles } from 'lucide-react';
import { api, type Booking } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import BookingCard from '../components/BookingCard';
import { Skeleton } from '../components/ui/Skeleton';
import Button from '../components/ui/Button';

export default function BookingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    api.myBookings()
      .then(setBookings)
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 px-6"
      >
        <div className="w-20 h-20 rounded-3xl bg-brand-100 flex items-center justify-center mb-6">
          <CalendarDays className="w-10 h-10 text-brand-600" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-stone-900">
          {isOwner ? 'Incoming bookings' : 'Your bookings'}
        </h2>
        <p className="text-stone-500 text-sm mt-2 text-center max-w-sm">
          {isOwner
            ? 'Sign in to view customer appointments at your salon.'
            : 'Sign in to view and manage your salon appointments.'}
        </p>
        <Link to="/login" className="mt-6">
          <Button size="lg">Sign In</Button>
        </Link>
      </motion.div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const filtered = bookings.filter((b) => {
    if (filter === 'upcoming') return b.slot_date >= today && b.status !== 'cancelled';
    if (filter === 'past') return b.slot_date < today || b.status === 'completed';
    return true;
  });

  const upcomingCount = bookings.filter((b) => b.slot_date >= today && b.status !== 'cancelled').length;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-semibold text-stone-900">
          {isOwner ? 'Incoming Bookings' : 'My Bookings'}
        </h1>
        <p className="text-stone-500 text-sm mt-1">
          {isOwner
            ? upcomingCount > 0
              ? `${upcomingCount} customer appointment${upcomingCount !== 1 ? 's' : ''} at your salon`
              : 'Customer appointments at your salon'
            : upcomingCount > 0
              ? `You have ${upcomingCount} upcoming appointment${upcomingCount !== 1 ? 's' : ''}`
              : 'Manage your salon appointments'}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl w-fit">
        {(['all', 'upcoming', 'past'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all duration-200 ${
              filter === tab
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-white border border-stone-100 p-5 space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 px-6 rounded-3xl bg-white border border-stone-100"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-brand-400" />
          </div>
          <h3 className="font-display text-xl font-semibold text-stone-800">
            {filter === 'all' ? 'No bookings yet' : `No ${filter} bookings`}
          </h3>
          <p className="text-stone-500 text-sm mt-2">
            Discover salons and book your first appointment.
          </p>
          <Link to={isOwner ? '/dashboard' : '/'} className="inline-block mt-6">
            <Button>
              <Search className="w-4 h-4" /> {isOwner ? 'Go to Dashboard' : 'Browse Salons'}
            </Button>
          </Link>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {filtered.map((booking, i) => (
            <BookingCard key={booking.id} booking={booking} index={i} ownerView={isOwner} />
          ))}
        </div>
      )}
    </div>
  );
}
