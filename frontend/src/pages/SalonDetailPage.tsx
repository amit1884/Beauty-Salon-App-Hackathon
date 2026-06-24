import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Star,
  Clock,
  Check,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { api, type Review, type Salon, type Service, type Slot } from '../lib/api';
import { homePathWithCity } from '../lib/cityStorage';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { cn, formatDate, formatPrice, formatSalonGender, formatTime, salonGradient } from '../lib/utils';

type Step = 1 | 2 | 3;

export default function SalonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const homeTo = homePathWithCity();
  const [salon, setSalon] = useState<Salon | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'book' | 'reviews' | 'services'>('book');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewHover, setReviewHover] = useState(0);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.getSalon(id).then(setSalon),
      api.listReviews(id).then(setReviews),
      api.listSlots(id).then(setSlots),
    ])
      .catch(() => setMessage('Salon not found'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (user?.role === 'owner') setActiveTab('services');
  }, [user?.role]);

  const handleBook = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (!salon || !selectedService || !selectedSlot) return;

    setBooking(true);
    setMessage('');
    try {
      await api.createBooking({
        salon_id: salon.id,
        service_id: selectedService.id,
        slot_id: selectedSlot.id,
      });
      setConfirmed(true);
      setSlots((prev) => prev.filter((s) => s.id !== selectedSlot.id));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!salon || reviewRating < 1) {
      setReviewMessage('Please select a star rating');
      return;
    }

    setSubmittingReview(true);
    setReviewMessage('');
    try {
      const created = await api.createReview(salon.id, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviews((prev) => [created, ...prev]);
      setReviewRating(0);
      setReviewComment('');
      setReviewSubmitted(true);
      setReviewMessage('');
      const updated = await api.getSalon(salon.id);
      setSalon(updated);
    } catch (err) {
      setReviewMessage(err instanceof Error ? err.message : 'Could not submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="text-center py-20">
        <p className="text-stone-500">{message || 'Salon not found'}</p>
        <Link to={homeTo} className="text-brand-600 text-sm mt-4 inline-block">← Back to home</Link>
      </div>
    );
  }

  const gradient = salonGradient(salon.name);
  const isOwner = user?.role === 'owner';
  const isMySalon = !!(user && salon.owner_id === user.id);
  const canBook = !user || user.role === 'customer';
  const canReview = user?.role === 'customer' && !isMySalon;
  const hasReviewed = !!(user && reviews.some((r) => r.customer_id === user.id));
  const steps = [
    { num: 1 as Step, label: 'Service' },
    { num: 2 as Step, label: 'Time' },
    { num: 3 as Step, label: 'Confirm' },
  ];

  // Group slots by date
  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    (acc[slot.slot_date] ??= []).push(slot);
    return acc;
  }, {});

  return (
    <div className="space-y-6 pb-8">
      <Link
        to={homeTo}
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-brand-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to salons
      </Link>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('relative overflow-hidden rounded-3xl bg-linear-to-br h-52 md:h-64', gradient)}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.2),transparent_60%)]" />
        <div className="absolute bottom-0 inset-x-0 p-6 md:p-8 bg-linear-to-t from-black/60 via-black/30 to-transparent">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="muted">{formatSalonGender(salon.gender)}</Badge>
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-semibold text-white">{salon.name}</h1>
              <div className="flex items-center gap-1.5 mt-2 text-white/80 text-sm">
                <MapPin className="w-4 h-4" />
                {salon.address}, {salon.city}
              </div>
            </div>
            {salon.avg_rating != null && (
              <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/20 backdrop-blur text-white">
                <Star className="w-4 h-4 fill-gold-400 text-gold-400" />
                <span className="font-semibold">{salon.avg_rating}</span>
                <span className="text-white/60 text-sm">({salon.review_count})</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {salon.description && (
        <p className="text-stone-600 leading-relaxed">{salon.description}</p>
      )}

      {isMySalon && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-brand-50 border border-brand-100">
          <p className="text-sm text-brand-800 font-medium">This is your salon</p>
          <Link to="/dashboard">
            <Button size="sm">Manage in Dashboard →</Button>
          </Link>
        </div>
      )}

      {isOwner && !isMySalon && (
        <div className="p-4 rounded-2xl bg-stone-100 border border-stone-200 text-sm text-stone-600">
          You&apos;re viewing as a salon owner. To book appointments, use a customer account.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-stone-100 rounded-2xl w-fit">
        {(canBook ? ['book', 'reviews'] : ['services', 'reviews'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as 'book' | 'reviews' | 'services')}
            className={cn(
              'px-5 py-2.5 rounded-xl text-sm font-medium capitalize transition-all',
              activeTab === tab ? 'bg-white text-brand-700 shadow-sm' : 'text-stone-500',
            )}
          >
            {tab === 'book' ? 'Book Now' : tab === 'services' ? 'Services' : `Reviews (${reviews.length})`}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'services' && !canBook ? (
          <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 max-w-xl">
            {(salon.services ?? []).map((service) => (
              <div key={service.id} className="flex justify-between p-4 rounded-xl bg-white border border-stone-100">
                <div>
                  <p className="font-medium">{service.name}</p>
                  <p className="text-sm text-stone-500">{service.duration_minutes} min</p>
                </div>
                <span className="font-semibold text-brand-700">{formatPrice(service.price)}</span>
              </div>
            ))}
          </motion.div>
        ) : activeTab === 'book' && canBook ? (
          <motion.div
            key="book"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="grid lg:grid-cols-5 gap-6"
          >
            {/* Booking wizard */}
            <div className="lg:col-span-3 space-y-6">
              {confirmed ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-12 px-6 rounded-3xl bg-white border border-emerald-100 shadow-sm"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4"
                  >
                    <Check className="w-8 h-8 text-emerald-600" />
                  </motion.div>
                  <h3 className="font-display text-2xl font-semibold text-stone-900">Booking Confirmed!</h3>
                  <p className="text-stone-500 text-sm mt-2">
                    {selectedService?.name} at {formatTime(selectedSlot!.slot_time)} on {formatDate(selectedSlot!.slot_date)}
                  </p>
                  <div className="flex gap-3 justify-center mt-6">
                    <Link to="/bookings">
                      <Button variant="secondary">View Bookings</Button>
                    </Link>
                    <Button variant="outline" onClick={() => { setConfirmed(false); setStep(1); setSelectedService(null); setSelectedSlot(null); }}>
                      Book Another
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Step indicator */}
                  <div className="flex items-center gap-2">
                    {steps.map((s, i) => (
                      <div key={s.num} className="flex items-center gap-2 flex-1">
                        <button
                          onClick={() => {
                            if (s.num === 1 || (s.num === 2 && selectedService) || (s.num === 3 && selectedService && selectedSlot)) {
                              setStep(s.num);
                            }
                          }}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all flex-1',
                            step === s.num
                              ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                              : step > s.num
                                ? 'bg-brand-50 text-brand-700'
                                : 'bg-stone-100 text-stone-400',
                          )}
                        >
                          <span className={cn(
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                            step === s.num ? 'bg-white/20' : step > s.num ? 'bg-brand-200 text-brand-800' : 'bg-stone-200',
                          )}>
                            {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                          </span>
                          <span className="hidden sm:inline">{s.label}</span>
                        </button>
                        {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-stone-300 shrink-0" />}
                      </div>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {step === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-3"
                      >
                        <h3 className="font-semibold text-stone-900">Choose a service</h3>
                        {(salon.services ?? []).map((service) => (
                          <motion.button
                            key={service.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => { setSelectedService(service); setStep(2); }}
                            className={cn(
                              'w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-4',
                              selectedService?.id === service.id
                                ? 'border-brand-400 bg-brand-50 shadow-sm'
                                : 'border-stone-100 bg-white hover:border-brand-200 hover:shadow-sm',
                            )}
                          >
                            <div>
                              <p className="font-medium text-stone-900">{service.name}</p>
                              <p className="text-sm text-stone-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3.5 h-3.5" /> {service.duration_minutes} min
                              </p>
                            </div>
                            <span className="font-semibold text-brand-700">{formatPrice(service.price)}</span>
                          </motion.button>
                        ))}
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-stone-900">Pick a time slot</h3>
                          <button onClick={() => setStep(1)} className="text-sm text-brand-600">← Change service</button>
                        </div>

                        {Object.keys(slotsByDate).length === 0 ? (
                          <p className="text-stone-500 text-sm py-8 text-center">No open slots right now.</p>
                        ) : (
                          Object.entries(slotsByDate).map(([date, dateSlots]) => (
                            <div key={date}>
                              <p className="text-sm font-medium text-stone-500 mb-2">{formatDate(date)}</p>
                              <div className="flex flex-wrap gap-2">
                                {dateSlots.map((slot) => (
                                  <motion.button
                                    key={slot.id}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setSelectedSlot(slot); setStep(3); }}
                                    className={cn(
                                      'px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all',
                                      selectedSlot?.id === slot.id
                                        ? 'border-brand-500 bg-brand-600 text-white shadow-md'
                                        : 'border-stone-200 bg-white text-stone-700 hover:border-brand-300',
                                    )}
                                  >
                                    {formatTime(slot.slot_time)}
                                  </motion.button>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </motion.div>
                    )}

                    {step === 3 && selectedService && selectedSlot && (
                      <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <h3 className="font-semibold text-stone-900">Confirm your booking</h3>
                        <div className="rounded-2xl bg-white border border-stone-100 p-5 space-y-4 shadow-sm">
                          {[
                            { label: 'Salon', value: salon.name },
                            { label: 'Service', value: selectedService.name },
                            { label: 'Date', value: formatDate(selectedSlot.slot_date) },
                            { label: 'Time', value: formatTime(selectedSlot.slot_time) },
                            { label: 'Duration', value: `${selectedService.duration_minutes} min` },
                          ].map((row) => (
                            <div key={row.label} className="flex justify-between text-sm">
                              <span className="text-stone-500">{row.label}</span>
                              <span className="font-medium text-stone-900">{row.value}</span>
                            </div>
                          ))}
                          <div className="border-t border-stone-100 pt-4 flex justify-between">
                            <span className="font-semibold text-stone-900">Total</span>
                            <span className="font-display text-xl font-semibold text-brand-700">
                              {formatPrice(selectedService.price)}
                            </span>
                          </div>
                        </div>

                        {message && (
                          <p className="text-red-600 text-sm">{message}</p>
                        )}

                        <div className="flex gap-3">
                          <Button variant="outline" onClick={() => setStep(2)} className="flex-1 bg-white">
                            Back
                          </Button>
                          <Button onClick={handleBook} loading={booking} className="flex-1">
                            Confirm Booking
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* Summary sidebar */}
            <div className="lg:col-span-2">
              <div className="sticky top-24 rounded-2xl bg-white border border-stone-100 p-5 shadow-sm space-y-4">
                <h4 className="font-semibold text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-500" /> Booking Summary
                </h4>
                {selectedService ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Service</span>
                        <span className="font-medium">{selectedService.name}</span>
                      </div>
                      {selectedSlot && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-stone-500">Date</span>
                            <span className="font-medium">{formatDate(selectedSlot.slot_date)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-500">Time</span>
                            <span className="font-medium">{formatTime(selectedSlot.slot_time)}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="border-t border-stone-100 pt-3 flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-brand-700">{formatPrice(selectedService.price)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-stone-400">Select a service to see summary</p>
                )}
                <Badge variant="warning">Pay at salon</Badge>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reviews"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="space-y-4 max-w-2xl"
          >
            {canReview && !hasReviewed && (
              <form
                onSubmit={handleSubmitReview}
                className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm space-y-4"
              >
                <div>
                  <h3 className="font-semibold text-stone-900">Write a review</h3>
                  <p className="text-sm text-stone-500 mt-0.5">Share your experience at {salon.name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-stone-700">Rating</label>
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => {
                      const value = i + 1;
                      const active = value <= (reviewHover || reviewRating);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setReviewRating(value)}
                          onMouseEnter={() => setReviewHover(value)}
                          onMouseLeave={() => setReviewHover(0)}
                          className="p-1 rounded-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                          aria-label={`${value} star${value !== 1 ? 's' : ''}`}
                        >
                          <Star
                            className={cn(
                              'w-7 h-7 transition-colors',
                              active ? 'fill-gold-400 text-gold-400' : 'text-stone-300',
                            )}
                          />
                        </button>
                      );
                    })}
                    {reviewRating > 0 && (
                      <span className="ml-2 text-sm text-stone-500">{reviewRating} / 5</span>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="review-comment" className="text-sm font-medium text-stone-700">
                    Comment <span className="text-stone-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="review-comment"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="What did you like? How was the service?"
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
                  />
                </div>

                {reviewMessage && (
                  <p className={cn(
                    'text-sm',
                    reviewMessage.startsWith('Thanks') ? 'text-green-600' : 'text-red-600',
                  )}>
                    {reviewMessage}
                  </p>
                )}

                <Button type="submit" loading={submittingReview} disabled={reviewRating < 1}>
                  Submit review
                </Button>
              </form>
            )}

            {!user && (
              <div className="p-5 rounded-2xl bg-brand-50 border border-brand-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-brand-800">Sign in to leave a review</p>
                <Button size="sm" onClick={() => navigate('/login')}>Sign in</Button>
              </div>
            )}

            {reviewSubmitted && (
              <div className="p-4 rounded-2xl bg-green-50 border border-green-100 text-sm text-green-700">
                Thanks for your review!
              </div>
            )}

            {canReview && hasReviewed && !reviewSubmitted && (
              <p className="text-sm text-stone-500 px-1">You&apos;ve already reviewed this salon.</p>
            )}

            {reviews.length === 0 ? (
              <div className="text-center py-12 rounded-2xl bg-white border border-stone-100">
                <MessageSquare className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500 text-sm">No reviews yet. Be the first!</p>
              </div>
            ) : (
              reviews.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="p-5 rounded-2xl bg-white border border-stone-100 shadow-sm"
                >
                  <div className="flex items-center gap-1 mb-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star
                        key={j}
                        className={cn('w-4 h-4', j < r.rating ? 'fill-gold-400 text-gold-400' : 'text-stone-200')}
                      />
                    ))}
                  </div>
                  {r.comment && <p className="text-stone-700 text-sm leading-relaxed">{r.comment}</p>}
                  <p className="text-xs text-stone-400 mt-2">
                    {new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
