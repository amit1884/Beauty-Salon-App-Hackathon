import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  CalendarDays,
  User,
  LogOut,
  Sparkles,
  LayoutDashboard,
  Shield,
  MessageCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSelectedCity } from '../hooks/useSelectedCity';
import { homePathWithCity } from '../lib/cityStorage';
import { cn } from '../lib/utils';
import CitySelector from './CitySelector';

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  auth?: boolean;
  guest?: boolean;
};

function withAssistant(items: NavItem[]): NavItem[] {
  const chat: NavItem = { to: '/chat', label: 'AI Assistant', icon: MessageCircle, auth: true };
  const idx = items.findIndex((i) => i.to === '/account' || i.to === '/login');
  if (idx === -1) return [...items, chat];
  return [...items.slice(0, idx), chat, ...items.slice(idx)];
}

function getNavItems(role?: string, homeTo = '/'): NavItem[] {
  if (role === 'admin') {
    return withAssistant([
      { to: '/admin', label: 'Moderation', icon: Shield },
      { to: homeTo, label: 'Browse Salons', icon: Home, end: true },
      { to: '/account', label: 'Profile', icon: User, auth: true },
    ]);
  }
  if (role === 'owner') {
    return withAssistant([
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/bookings', label: 'Incoming Bookings', icon: CalendarDays },
      { to: homeTo, label: 'Browse Salons', icon: Home, end: true },
      { to: '/account', label: 'Profile', icon: User, auth: true },
    ]);
  }
  return withAssistant([
    { to: homeTo, label: 'Discover', icon: Home, end: true },
    { to: '/bookings', label: 'My Bookings', icon: CalendarDays },
    { to: '/account', label: 'Profile', icon: User, auth: true },
    { to: '/login', label: 'Sign In', icon: User, guest: true },
  ]);
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { city } = useSelectedCity();
  const navItems = getNavItems(user?.role, homePathWithCity(city));

  return (
    <nav className="flex flex-col gap-1.5">
      {navItems.map((item) => {
        if ('auth' in item && item.auth && !user) return null;
        if ('guest' in item && item.guest && user) return null;

        const Icon = item.icon;
        return (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={'end' in item ? item.end : false}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-white/15 text-white shadow-lg shadow-black/10'
                  : 'text-white/70 hover:text-white hover:bg-white/10',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('w-5 h-5', isActive && 'text-brand-200')} />
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-300"
                  />
                )}
              </>
            )}
          </NavLink>
        );
      })}

      {user && (
        <button
          onClick={() => { logout(); onNavigate?.(); }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all mt-2"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      )}
    </nav>
  );
}

function MobileNav() {
  const { user } = useAuth();
  const { city } = useSelectedCity();
  const homeTo = homePathWithCity(city);
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';

  const items = isAdmin
    ? [
        { to: '/admin', label: 'Admin', icon: Shield },
        { to: '/chat', label: 'AI', icon: MessageCircle },
        { to: homeTo, label: 'Browse', icon: Home, end: true },
        { to: '/account', label: 'Profile', icon: User },
      ]
    : isOwner
    ? [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/chat', label: 'AI', icon: MessageCircle },
        { to: '/bookings', label: 'Bookings', icon: CalendarDays },
        { to: '/account', label: 'Profile', icon: User },
      ]
    : [
        { to: homeTo, label: 'Home', icon: Home, end: true },
        { to: '/chat', label: 'AI', icon: MessageCircle },
        { to: '/bookings', label: 'Bookings', icon: CalendarDays },
        { to: user ? '/account' : '/login', label: user ? 'Profile' : 'Sign In', icon: User },
      ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-stone-200/60 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around py-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[10px] font-medium transition-all',
                  isActive ? 'text-brand-600' : 'text-stone-400',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className={cn(
                    'p-1.5 rounded-xl transition-all',
                    isActive && 'bg-brand-100 text-brand-600',
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isChatPage = location.pathname === '/chat';
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin';
  const showCitySelector = (!isOwner && !isAdmin || location.pathname === '/') && !isChatPage;

  if (isLoginPage) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="login"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-screen"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className={cn('min-h-screen flex', isChatPage && 'h-dvh overflow-hidden')}>
      <aside className="hidden md:flex w-72 shrink-0 flex-col bg-linear-to-b from-brand-800 via-brand-700 to-brand-900 text-white">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
              <Sparkles className="w-5 h-5 text-brand-200" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-wide">SalonBook</h1>
              <p className="text-xs text-white/50">
                {isAdmin ? 'Admin portal' : isOwner ? 'Owner portal' : 'Beauty marketplace'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-4">
          <SidebarNav />
        </div>

        {user && (
          <div className="p-4 m-4 rounded-2xl bg-white/10 backdrop-blur border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-brand-300 to-brand-500 flex items-center justify-center text-brand-900 font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{user.name}</p>
                <p className="text-xs text-white/50 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className={cn('flex-1 flex flex-col min-w-0', isChatPage && 'min-h-0 overflow-hidden')}>
        <header className="md:hidden sticky top-0 z-40 glass border-b border-stone-200/60 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-600" />
              <span className="font-display text-xl font-semibold text-brand-800">SalonBook</span>
            </div>
            {user && (
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {showCitySelector && <CitySelector />}
        </header>

        <header className="hidden md:flex sticky top-0 z-40 glass border-b border-stone-200/60 px-8 py-4 items-center justify-between gap-6">
          {showCitySelector ? (
            <CitySelector />
          ) : isChatPage ? (
            <p className="text-sm text-stone-500">AI Assistant</p>
          ) : (
            <p className="text-sm text-stone-500">
              {location.pathname === '/dashboard' ? 'Manage your salon' : 'Owner portal'}
            </p>
          )}
          {!user ? (
            <NavLink to="/login" className="shrink-0 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
              Sign In →
            </NavLink>
          ) : (
            <NavLink to="/account" className="shrink-0 flex items-center gap-2 text-sm text-stone-600 hover:text-brand-600 transition-colors">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              {user.name.split(' ')[0]}
            </NavLink>
          )}
        </header>

        <main
          className={cn(
            'flex-1 flex flex-col min-h-0',
            isChatPage ? 'overflow-hidden pb-0 md:pb-0' : 'overflow-y-auto pb-24 md:pb-8',
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'page-enter max-w-6xl mx-auto w-full',
                isChatPage
                  ? 'flex flex-1 flex-col min-h-0 px-4 md:px-8 pt-3 md:pt-4'
                  : 'px-4 md:px-8 py-6',
              )}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
