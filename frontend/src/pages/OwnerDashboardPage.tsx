import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Store,
  Scissors,
  CalendarPlus,
  Users,
  Star,
  Clock,
  Plus,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api, type Booking, type Salon, type SalonGender, type Service, type Slot } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import BookingCard from '../components/BookingCard';
import { cn, formatDate, formatPrice, formatSalonGender, formatTime, SALON_GENDER_OPTIONS } from '../lib/utils';

type Tab = 'overview' | 'services' | 'slots' | 'profile';

const statusBadge = {
  approved: { label: 'Live', variant: 'success' as const },
  pending: { label: 'Pending approval', variant: 'warning' as const },
  rejected: { label: 'Rejected', variant: 'muted' as const },
};

export default function OwnerDashboardPage() {
  const { user } = useAuth();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Create salon form
  const [salonForm, setSalonForm] = useState({
    name: '', city: '', address: '', description: '', gender: 'both' as SalonGender,
  });

  // Service form
  const [serviceForm, setServiceForm] = useState({ name: '', price: '', duration: '60' });

  // Slot form
  const [slotForm, setSlotForm] = useState({ date: '', time: '10:00' });

  const [saving, setSaving] = useState(false);

  const loadSalonData = useCallback(async (s: Salon) => {
    setSalon(s);
    const [slotData, bookingData] = await Promise.all([
      api.listSlotsManage(s.id),
      api.myBookings(),
    ]);
    setSlots(slotData);
    setBookings(bookingData);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const mine = await api.mySalons();
      if (mine.length > 0) {
        await loadSalonData(mine[0]);
      } else {
        setSalon(null);
      }
    } catch {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [loadSalonData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createSalon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await api.createSalon({
        name: salonForm.name,
        city: salonForm.city,
        address: salonForm.address,
        description: salonForm.description || null,
        gender: salonForm.gender,
      });
      setMessage('Salon created! It will appear in search once approved.');
      setSalonForm({ name: '', city: '', address: '', description: '', gender: 'both' });
      await loadSalonData(created);
      setTab('services');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create salon');
    } finally {
      setSaving(false);
    }
  };

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;
    setSaving(true);
    setError('');
    try {
      await api.addService(salon.id, {
        name: serviceForm.name,
        price: parseFloat(serviceForm.price),
        duration_minutes: parseInt(serviceForm.duration, 10),
      });
      setMessage('Service added');
      setServiceForm({ name: '', price: '', duration: '60' });
      const updated = await api.mySalons();
      if (updated[0]) await loadSalonData(updated[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add service');
    } finally {
      setSaving(false);
    }
  };

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salon) return;
    setSaving(true);
    setError('');
    try {
      await api.createSlot(salon.id, {
        slot_date: slotForm.date,
        slot_time: slotForm.time.length === 5 ? `${slotForm.time}:00` : slotForm.time,
      });
      setMessage('Time slot added');
      setSlotForm({ date: '', time: '10:00' });
      setSlots(await api.listSlotsManage(salon.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add slot');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  // No salon yet — onboarding
  if (!salon) {
    return (
      <div className="max-w-xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-100 flex items-center justify-center mb-4">
            <Store className="w-8 h-8 text-brand-600" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-stone-900">Set up your salon</h1>
          <p className="text-stone-500 text-sm mt-2">
            Welcome, {user?.name}! Create your salon profile to start accepting bookings.
          </p>
        </motion.div>

        <form onSubmit={createSalon} className="space-y-4 bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium text-stone-700">Salon name</label>
            <input required className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={salonForm.name} onChange={(e) => setSalonForm({ ...salonForm, name: e.target.value })} placeholder="Glow Studio" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-stone-700">City</label>
              <input required className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={salonForm.city} onChange={(e) => setSalonForm({ ...salonForm, city: e.target.value })} placeholder="Mumbai" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700">Address</label>
              <input required className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={salonForm.address} onChange={(e) => setSalonForm({ ...salonForm, address: e.target.value })} placeholder="Bandra West" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Description</label>
            <textarea className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none h-24"
              value={salonForm.description} onChange={(e) => setSalonForm({ ...salonForm, description: e.target.value })} placeholder="Tell customers about your salon..." />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Serves</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SALON_GENDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSalonForm({ ...salonForm, gender: option.value })}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium border transition-all',
                    salonForm.gender === option.value
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-brand-300',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" loading={saving} size="lg" className="w-full">
            <Plus className="w-4 h-4" /> Create Salon
          </Button>
        </form>
      </div>
    );
  }

  const services = salon.services ?? [];
  const openSlots = slots.filter((s) => !s.is_booked).length;
  const badge = statusBadge[salon.status as keyof typeof statusBadge] ?? statusBadge.pending;
  const upcomingBookings = bookings.filter((b) => b.status !== 'cancelled');

  const tabs: { id: Tab; label: string; icon: typeof Store }[] = [
    { id: 'overview', label: 'Overview', icon: Store },
    { id: 'services', label: 'Services', icon: Scissors },
    { id: 'slots', label: 'Availability', icon: CalendarPlus },
    { id: 'profile', label: 'Salon Info', icon: Store },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-semibold text-stone-900">{salon.name}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-stone-500 text-sm mt-1">{salon.city} · Owner dashboard</p>
        </div>
        {salon.status === 'approved' && (
          <Link to={`/salons/${salon.id}`}>
            <Button variant="outline" className="bg-white">View public page</Button>
          </Link>
        )}
      </div>

      {salon.status === 'pending' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Awaiting approval</p>
            <p className="text-amber-700/80 mt-0.5">Your salon isn&apos;t visible in search yet. You can still add services and slots while we review.</p>
          </div>
        </motion.div>
      )}

      {message && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">
          <CheckCircle2 className="w-4 h-4" /> {message}
        </motion.div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Services', value: services.length, icon: Scissors, color: 'bg-violet-100 text-violet-600' },
          { label: 'Open slots', value: openSlots, icon: Clock, color: 'bg-blue-100 text-blue-600' },
          { label: 'Bookings', value: upcomingBookings.length, icon: Users, color: 'bg-brand-100 text-brand-600' },
          { label: 'Rating', value: salon.avg_rating ?? '—', icon: Star, color: 'bg-amber-100 text-amber-600' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-4 rounded-2xl bg-white border border-stone-100 shadow-sm">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2', stat.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-semibold text-stone-900">{stat.value}</p>
              <p className="text-xs text-stone-500">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setMessage(''); setError(''); }}
              className={cn(
                'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                tab === t.id ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:border-brand-300',
              )}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <h3 className="font-semibold text-stone-900">Recent bookings</h3>
          {upcomingBookings.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white border border-stone-100">
              <Users className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 text-sm">No bookings yet. Add services and open slots to get started.</p>
              <Button className="mt-4" variant="outline" onClick={() => setTab('slots')}>Add availability</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookings.slice(0, 5).map((b, i) => (
                <BookingCard key={b.id} booking={b} index={i} ownerView />
              ))}
              {upcomingBookings.length > 5 && (
                <Link to="/bookings" className="block text-center text-sm text-brand-600 hover:underline">
                  View all {upcomingBookings.length} bookings →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'services' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-stone-900">Your services ({services.length})</h3>
            {services.length === 0 ? (
              <p className="text-stone-500 text-sm py-8 text-center bg-white rounded-2xl border border-stone-100">No services yet</p>
            ) : (
              services.map((s: Service) => (
                <div key={s.id} className="flex justify-between items-center p-4 rounded-xl bg-white border border-stone-100">
                  <div>
                    <p className="font-medium text-stone-900">{s.name}</p>
                    <p className="text-xs text-stone-500">{s.duration_minutes} min</p>
                  </div>
                  <span className="font-semibold text-brand-700">{formatPrice(s.price)}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addService} className="space-y-3 bg-white rounded-2xl border border-stone-100 p-5 shadow-sm h-fit">
            <h3 className="font-semibold text-stone-900">Add service</h3>
            <input required placeholder="Service name" className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input required type="number" min="1" placeholder="Price (₹)" className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={serviceForm.price} onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })} />
              <input type="number" min="15" step="15" placeholder="Duration (min)" className="w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={serviceForm.duration} onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })} />
            </div>
            <Button type="submit" loading={saving} className="w-full">
              <Plus className="w-4 h-4" /> Add Service
            </Button>
          </form>
        </div>
      )}

      {tab === 'slots' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-stone-900">Time slots ({slots.length})</h3>
            {slots.length === 0 ? (
              <p className="text-stone-500 text-sm py-8 text-center bg-white rounded-2xl border border-stone-100">No slots yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {slots.map((s) => (
                  <div key={s.id} className={cn(
                    'flex justify-between items-center p-3 rounded-xl border text-sm',
                    s.is_booked ? 'bg-stone-50 border-stone-100 text-stone-400' : 'bg-white border-brand-100',
                  )}>
                    <span>{formatDate(s.slot_date)} · {formatTime(s.slot_time)}</span>
                    <Badge variant={s.is_booked ? 'muted' : 'success'}>{s.is_booked ? 'Booked' : 'Open'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={addSlot} className="space-y-3 bg-white rounded-2xl border border-stone-100 p-5 shadow-sm h-fit">
            <h3 className="font-semibold text-stone-900">Add time slot</h3>
            <div>
              <label className="text-xs text-stone-500">Date</label>
              <input required type="date" min={new Date().toISOString().split('T')[0]}
                className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={slotForm.date} onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-stone-500">Time</label>
              <input required type="time"
                className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={slotForm.time} onChange={(e) => setSlotForm({ ...slotForm, time: e.target.value })} />
            </div>
            <Button type="submit" loading={saving} className="w-full">
              <Plus className="w-4 h-4" /> Add Slot
            </Button>
          </form>
        </div>
      )}

      {tab === 'profile' && (
        <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-stone-900">Salon details</h3>
          {[
            { label: 'Name', value: salon.name },
            { label: 'City', value: salon.city },
            { label: 'Address', value: salon.address },
            { label: 'Serves', value: formatSalonGender(salon.gender) },
            { label: 'Status', value: salon.status },
            { label: 'Reviews', value: `${salon.review_count} (${salon.avg_rating ?? 'N/A'}★)` },
          ].map((row) => (
            <div key={row.label} className="flex justify-between text-sm border-b border-stone-50 pb-3">
              <span className="text-stone-500">{row.label}</span>
              <span className="font-medium text-stone-900 capitalize">{row.value}</span>
            </div>
          ))}
          {salon.description && (
            <div className="text-sm">
              <span className="text-stone-500">Description</span>
              <p className="mt-1 text-stone-700">{salon.description}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
