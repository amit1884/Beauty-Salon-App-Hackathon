const GRADIENTS = [
  'from-rose-400 via-pink-500 to-fuchsia-600',
  'from-violet-400 via-purple-500 to-indigo-600',
  'from-amber-400 via-orange-400 to-rose-500',
  'from-teal-400 via-cyan-500 to-blue-600',
  'from-emerald-400 via-green-500 to-teal-600',
  'from-fuchsia-400 via-pink-500 to-rose-600',
];

import type { SalonGender } from './api';

export function salonGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const SERVICE_CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Haircut', value: 'haircut' },
  { label: 'Facial', value: 'facial' },
  { label: 'Bridal', value: 'bridal' },
  { label: 'Spa', value: 'spa' },
  { label: 'Makeup', value: 'makeup' },
];

export const SALON_GENDER_OPTIONS: { label: string; value: SalonGender }[] = [
  { label: 'Women', value: 'female' },
  { label: 'Men', value: 'male' },
  { label: 'Unisex', value: 'both' },
];

export function formatSalonGender(gender: SalonGender | undefined): string {
  return SALON_GENDER_OPTIONS.find((o) => o.value === (gender ?? 'both'))?.label ?? 'Unisex';
}
