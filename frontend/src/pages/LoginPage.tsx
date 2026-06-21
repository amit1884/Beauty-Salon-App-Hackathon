import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import { cn } from '../lib/utils';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'customer' | 'owner'>('customer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let loggedInUser;
      if (mode === 'login') {
        loggedInUser = await login(email, password);
      } else {
        loggedInUser = await register(name, email, password, role);
      }
      navigate(
        loggedInUser.role === 'owner' ? '/dashboard'
          : loggedInUser.role === 'admin' ? '/admin'
          : '/',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-brand-800 via-brand-700 to-brand-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-brand-400/10 rounded-full animate-float" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-white/5 rounded-full" />

        <div className="relative z-10 max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur">
              <Sparkles className="w-6 h-6 text-brand-200" />
            </div>
            <span className="font-display text-3xl font-semibold">SalonBook</span>
          </div>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Your beauty journey starts here
          </h2>
          <p className="mt-4 text-white/60 leading-relaxed">
            Book appointments at top-rated salons. Hair, skin, bridal, spa — all in one place.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {['500+ Salons', '10k+ Bookings', '4.8★ Avg Rating'].map((stat) => (
              <div key={stat} className="text-center p-3 rounded-2xl bg-white/10 backdrop-blur">
                <p className="text-sm font-semibold">{stat}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-[#faf8f6]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Sparkles className="w-6 h-6 text-brand-600" />
            <span className="font-display text-2xl font-semibold text-brand-800">SalonBook</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="font-display text-3xl font-semibold text-stone-900">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="text-stone-500 text-sm mt-2">
                {mode === 'login'
                  ? 'Sign in to manage your bookings'
                  : 'Join thousands of happy customers'}
              </p>

              <form onSubmit={submit} className="mt-8 space-y-4">
                {mode === 'register' && (
                  <>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl">
                      {(['customer', 'owner'] as const).map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={cn(
                            'flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all',
                            role === r ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-500',
                          )}
                        >
                          {r === 'owner' ? 'Salon Owner' : 'Customer'}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 transition-all"
                    placeholder="Password (min 8 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-600 text-sm px-1"
                  >
                    {error}
                  </motion.p>
                )}

                <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <p className="mt-6 text-sm text-stone-500 text-center">
                {mode === 'login' ? (
                  <>Don&apos;t have an account?{' '}
                    <button className="text-brand-600 font-medium hover:underline" onClick={() => setMode('register')}>
                      Sign up free
                    </button>
                  </>
                ) : (
                  <>Already have an account?{' '}
                    <button className="text-brand-600 font-medium hover:underline" onClick={() => setMode('login')}>
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </motion.div>
          </AnimatePresence>

          <Link to="/" className="block text-center text-sm text-stone-400 mt-8 hover:text-brand-600 transition-colors">
            ← Continue as guest
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
