import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, XCircle, Clock, MapPin, Store } from 'lucide-react';
import { api, type Salon } from '../lib/api';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { cn, salonGradient } from '../lib/utils';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const statusConfig = {
  pending: { label: 'Pending', variant: 'warning' as const, icon: Clock },
  approved: { label: 'Approved', variant: 'success' as const, icon: CheckCircle },
  rejected: { label: 'Rejected', variant: 'muted' as const, icon: XCircle },
};

export default function AdminPage() {
  const [salons, setSalons] = useState<Salon[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminListSalons(filter === 'all' ? undefined : filter);
      setSalons(data);
    } catch {
      setSalons([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (salonId: string, status: 'approved' | 'rejected') => {
    setActing(salonId);
    setMessage('');
    try {
      await api.adminSetSalonStatus(salonId, status);
      setMessage(status === 'approved' ? 'Salon approved — now visible in search' : 'Salon rejected');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const pendingCount = filter === 'pending' ? salons.length : undefined;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center shrink-0">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-semibold text-stone-900">Admin Panel</h1>
          <p className="text-stone-500 text-sm mt-1">
            Review salon listings before they appear in public search.
          </p>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl w-fit flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all',
              filter === f ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {message && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          {message}
        </motion.p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : salons.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-white border border-stone-100">
          <Store className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">
            {filter === 'pending' ? 'No salons waiting for approval' : `No ${filter} salons`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filter === 'pending' && pendingCount !== undefined && pendingCount > 0 && (
            <p className="text-sm text-amber-700 font-medium">
              {pendingCount} salon{pendingCount !== 1 ? 's' : ''} need your review
            </p>
          )}
          {salons.map((salon, i) => {
            const cfg = statusConfig[salon.status as keyof typeof statusConfig] ?? statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <motion.div
                key={salon.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white border border-stone-100 overflow-hidden shadow-sm"
              >
                <div className={cn('h-2 bg-linear-to-r', salonGradient(salon.name))} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-stone-900">{salon.name}</h3>
                      <p className="flex items-center gap-1.5 text-sm text-stone-500 mt-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {salon.address}, {salon.city}
                      </p>
                      {salon.description && (
                        <p className="text-sm text-stone-600 mt-2 line-clamp-2">{salon.description}</p>
                      )}
                      <p className="text-xs text-stone-400 mt-2">
                        {(salon.services ?? []).length} service(s) listed
                      </p>
                    </div>
                    <Badge variant={cfg.variant}>
                      <StatusIcon className="w-3 h-3 mr-1 inline" />
                      {cfg.label}
                    </Badge>
                  </div>

                  {salon.status === 'pending' && (
                    <div className="flex gap-3 mt-4 pt-4 border-t border-stone-100">
                      <Button
                        className="flex-1"
                        loading={acting === salon.id}
                        onClick={() => setStatus(salon.id, 'approved')}
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 bg-white text-red-600 border-red-200 hover:bg-red-50"
                        disabled={acting === salon.id}
                        onClick={() => setStatus(salon.id, 'rejected')}
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </Button>
                    </div>
                  )}

                  {salon.status === 'rejected' && (
                    <div className="mt-4 pt-4 border-t border-stone-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white"
                        loading={acting === salon.id}
                        onClick={() => setStatus(salon.id, 'approved')}
                      >
                        Re-approve
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
