const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type UserRole = 'customer' | 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

export interface Salon {
  id: string;
  owner_id?: string;
  name: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  status: string;
  services?: Service[];
  avg_rating: number | null;
  review_count: number;
  distance_km?: number | null;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface Slot {
  id: string;
  slot_date: string;
  slot_time: string;
  is_booked: boolean;
}

export interface Review {
  id: string;
  salon_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  salon_id: string;
  salon_name: string;
  salon_city: string;
  salon_address: string;
  service_name: string;
  service_price: number;
  slot_date: string;
  slot_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  created_at: string;
  customer_name?: string | null;
}

export interface SalonCreatePayload {
  name: string;
  city: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
}

export type ChatActionPayload = Record<string, string | number | boolean | null | undefined>;

export interface ChatUIBlock {
  type: string;
  title?: string | null;
  data: Record<string, unknown>;
  actions?: Array<{ label: string; action: string; payload?: ChatActionPayload }>;
}

export interface ChatUIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ui_blocks?: ChatUIBlock[];
}

export interface ChatResponse {
  session_id: string;
  message: string;
  ui_blocks: ChatUIBlock[];
  role: string;
}

export interface ServiceCreatePayload {
  name: string;
  price: number;
  duration_minutes?: number;
}

export interface SlotCreatePayload {
  slot_date: string;
  slot_time: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Request failed');
  }
  return res.json();
}

export const api = {
  register: (data: { name: string; email: string; password: string; role?: UserRole; phone?: string }) =>
    request<{ access_token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: async (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error('Invalid email or password');
    return res.json() as Promise<{ access_token: string; user: User }>;
  },

  me: () => request<User>('/api/auth/me'),

  listSalons: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return request<Salon[]>(`/api/salons?${qs}`);
  },

  getSalon: (id: string) => request<Salon>(`/api/salons/${id}`),

  mySalons: () => request<Salon[]>('/api/salons/mine'),

  createSalon: (data: SalonCreatePayload) =>
    request<Salon>('/api/salons', { method: 'POST', body: JSON.stringify(data) }),

  updateSalon: (id: string, data: Partial<SalonCreatePayload>) =>
    request<Salon>(`/api/salons/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  addService: (salonId: string, data: ServiceCreatePayload) =>
    request<Service>(`/api/salons/${salonId}/services`, { method: 'POST', body: JSON.stringify(data) }),

  listSlots: (salonId: string, date?: string) => {
    const qs = new URLSearchParams({ salon_id: salonId });
    if (date) qs.set('slot_date', date);
    return request<Slot[]>(`/api/bookings/slots?${qs}`);
  },

  listSlotsManage: (salonId: string) =>
    request<Slot[]>(`/api/bookings/slots/manage?salon_id=${salonId}`),

  createSlot: (salonId: string, data: SlotCreatePayload) =>
    request<Slot>(`/api/bookings/slots?salon_id=${salonId}`, { method: 'POST', body: JSON.stringify(data) }),

  createBooking: (data: { salon_id: string; service_id: string; slot_id: string }) =>
    request<Booking>('/api/bookings', { method: 'POST', body: JSON.stringify(data) }),

  listReviews: (salonId: string) => request<Review[]>(`/api/reviews/salon/${salonId}`),

  createReview: (salonId: string, data: { rating: number; comment?: string }) =>
    request<Review>(`/api/reviews/salon/${salonId}`, { method: 'POST', body: JSON.stringify(data) }),

  myBookings: () => request<Booking[]>('/api/bookings/my'),

  adminListSalons: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return request<Salon[]>(`/api/admin/salons${qs}`);
  },

  adminSetSalonStatus: (salonId: string, status: 'approved' | 'rejected' | 'pending') =>
    request<Salon>(`/api/admin/salons/${salonId}/status?status=${status}`, { method: 'PATCH' }),

  agentChat: (data: {
    message: string;
    session_id?: string;
    action?: string;
    action_payload?: ChatActionPayload;
  }) =>
    request<ChatResponse>('/api/agent/chat', { method: 'POST', body: JSON.stringify(data) }),
};
