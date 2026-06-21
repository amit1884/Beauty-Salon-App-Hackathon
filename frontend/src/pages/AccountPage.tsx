import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Mail, Shield, CalendarDays, ChevronRight, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';

export default function AccountPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isOwner = user.role === 'owner';
  const isAdmin = user.role === 'admin';

  const menuItems = isAdmin
    ? [{ icon: Shield, label: 'Salon Moderation', to: '/admin' }]
    : isOwner
    ? [
        { icon: LayoutDashboard, label: 'Owner Dashboard', to: '/dashboard' },
        { icon: CalendarDays, label: 'Incoming Bookings', to: '/bookings' },
      ]
    : [{ icon: CalendarDays, label: 'My Bookings', to: '/bookings' }];

  return (
    <div className="max-w-lg space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 to-brand-800 p-8 text-white"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-2xl font-bold">
            {initials}
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">{user.name}</h1>
            <p className="text-white/60 text-sm mt-0.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> {user.email}
            </p>
            <Badge className="mt-2 bg-white/20 text-white capitalize">{user.role}</Badge>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-white border border-stone-100 overflow-hidden shadow-sm"
      >
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors ${
                i < menuItems.length - 1 ? 'border-b border-stone-100' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-brand-600" />
              </div>
              <span className="flex-1 font-medium text-stone-800">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </Link>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-white border border-stone-100 p-5 shadow-sm"
      >
        <div className="flex items-center gap-3 text-sm text-stone-500">
          <Shield className="w-4 h-4" />
          <span>Your data is securely stored and never shared.</span>
        </div>
      </motion.div>

      <Button
        variant="outline"
        onClick={logout}
        className="w-full bg-white"
      >
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>
    </div>
  );
}
