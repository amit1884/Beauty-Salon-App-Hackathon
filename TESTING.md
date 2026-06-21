# Features & Testing Guide

This document describes every major feature in SalonBook and step-by-step flows to test them locally. Use it for QA, demos, or onboarding new contributors.

> **Setup first:** See [README.md](README.md) to install dependencies and run the app.  
> **App URLs:** Frontend `http://localhost:5173` · API docs `http://localhost:8000/docs`

---

## Before you test

1. Backend running: `uvicorn app.main:app --reload --port 8000`
2. Frontend running: `npm run dev` (in `frontend/`)
3. Database seeded: `python scripts/seed.py` (in `backend/`)

### Demo accounts (password for all: `password123`)

| Role | Email | Lands on |
|---|---|---|
| Customer | `customer@demo.com` | Home / Discover |
| Salon owner | `owner@demo.com` | Owner Dashboard |
| Admin | `admin@demo.com` | Admin Panel |

### Seed data included

| Salon | City | Services | Slots |
|---|---|---|---|
| Glow Studio | Mumbai (Bandra West) | Haircut ₹499, Facial ₹1299, Bridal Makeup ₹8999 | Next 3 days, 10am–5pm |
| Luxe Hair & Spa | Mumbai (Andheri East) | Same as above | Same |
| Bliss Beauty Bar | Pune (Koregaon Park) | Same as above | Same |

All seed salons are **pre-approved** and visible in search immediately.

---

## Feature map by role

```
CUSTOMER                          OWNER                           ADMIN
─────────                         ─────                           ─────
• Search & browse salons          • Create salon listing          • Review pending salons
• Filter by city / category       • Add services & pricing        • Approve / reject listings
• View salon detail & reviews     • Add availability slots        • View all salon statuses
• Book appointment (3 steps)      • View incoming bookings        • Re-approve rejected salons
• My Bookings (upcoming/past)     • See booking stats             • Browse public salon list
• Global search (top bar)         • Pending → live after admin
```

---

## Test flows

### Flow 1 — Customer browses and books

**Goal:** Verify the core booking journey works end-to-end.

| Step | Action | Expected result |
|---|---|---|
| 1 | Open `http://localhost:5173` (no login) | Home page loads with salon cards |
| 2 | Type **Mumbai** in the top search bar → Search | Only Mumbai salons shown (Glow Studio, Luxe Hair & Spa) |
| 3 | Click category chip **Facial** | List filters to salons offering facial services |
| 4 | Click **Glow Studio** card | Salon detail page opens with hero, services, reviews tab |
| 5 | Click **Sign In** → log in as `customer@demo.com` | Redirected to Home after login |
| 6 | Open Glow Studio again → **Book Now** tab | 3-step booking wizard visible |
| 7 | Step 1: Select **Haircut** | Service highlighted, summary updates |
| 8 | Step 2: Pick a time slot (today or tomorrow) | Slot highlighted |
| 9 | Step 3: Click **Confirm Booking** | Success screen with checkmark |
| 10 | Go to **My Bookings** (sidebar or bottom nav) | Booking card shows salon, service, date, time, price |
| 11 | Return to Glow Studio → same slot | That slot no longer available |

**Pass criteria:** Booking appears in My Bookings; booked slot disappears from availability.

---

### Flow 2 — Customer search and filters

**Goal:** Verify discovery features.

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as customer (or stay logged out) | — |
| 2 | Search **Pune** in top bar | Only Bliss Beauty Bar appears |
| 3 | Clear search, click **Find near me** (navigation icon on home) | Browser may ask for location; salons load by proximity or fallback list |
| 4 | Click **Bridal** category chip | Salons with "Bridal Makeup" service remain |
| 5 | Click **All** chip | Full list restored |

**Pass criteria:** City search, category filters, and result counts update correctly.

---

### Flow 3 — Owner manages salon

**Goal:** Verify owner dashboard and salon management.

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as `owner@demo.com` | Redirected to **Dashboard** (`/dashboard`) |
| 2 | Review **Overview** tab | Stats show services count, open slots, bookings, rating |
| 3 | Go to **Services** tab → add "Manicure", ₹799, 45 min | Service appears in list |
| 4 | Go to **Availability** tab → add slot (tomorrow, 11:00 AM) | New slot shows as **Open** |
| 5 | Go to **Salon Info** tab | Salon details and **Live** status badge visible |
| 6 | Click **View public page** | Opens salon detail in customer view (no booking for owner) |
| 7 | Go to **Incoming Bookings** in sidebar | Customer bookings listed with customer name |

**Pass criteria:** Owner can add services/slots; incoming bookings show customer details.

---

### Flow 4 — Full lifecycle: new salon → approval → customer books

**Goal:** Test the complete marketplace loop across all three roles.

#### Part A — Owner creates a new salon

| Step | Action | Expected result |
|---|---|---|
| 1 | Sign out → **Sign up** as Salon Owner (new email) | Account created, lands on Dashboard |
| 2 | Fill **Create Salon** form (e.g. "Urban Cuts", Delhi, Connaught Place) | Salon created |
| 3 | Notice **Pending approval** banner | Status badge shows "Pending approval" |
| 4 | Add a service (e.g. Haircut ₹599) and a time slot | Saved successfully |
| 5 | Search **Delhi** as customer (different browser/incognito) | Urban Cuts **not** in results |

#### Part B — Admin approves

| Step | Action | Expected result |
|---|---|---|
| 6 | Sign out → log in as `admin@demo.com` | Lands on **Admin Panel** |
| 7 | **Pending** tab → find "Urban Cuts" | Salon card with Approve / Reject buttons |
| 8 | Click **Approve** | Success message; salon moves to Approved tab |

#### Part C — Customer books the new salon

| Step | Action | Expected result |
|---|---|---|
| 9 | Log in as `customer@demo.com` | Home page |
| 10 | Search **Delhi** | Urban Cuts now appears |
| 11 | Book an appointment at Urban Cuts | Booking confirmed |
| 12 | Log in as the new owner | **Incoming Bookings** shows the customer's booking |

**Pass criteria:** Salon hidden until approved; visible and bookable after admin approval.

---

### Flow 5 — Admin moderation

**Goal:** Verify admin approve/reject/re-approve.

| Step | Action | Expected result |
|---|---|---|
| 1 | Log in as `admin@demo.com` | Admin Panel loads |
| 2 | **Pending** tab | Lists salons awaiting review (if any) |
| 3 | Click **Reject** on a pending salon | Salon moves to Rejected tab; hidden from search |
| 4 | **Rejected** tab → click **Re-approve** | Salon becomes approved and searchable again |
| 5 | **Approved** tab | All live salons listed |
| 6 | **All** tab | Every salon regardless of status |

**Pass criteria:** Status changes reflect immediately; rejected salons don't appear in customer search.

---

### Flow 6 — Auth and role separation

**Goal:** Confirm each role sees the correct UI and permissions.

| Test | How to verify | Expected |
|---|---|---|
| Owner cannot book | Log in as owner → open any salon → Book tab | Booking hidden; message about using customer account |
| Owner owns their salon | Owner opens their own salon page | "Manage in Dashboard" banner shown |
| Customer cannot access dashboard | Log in as customer → visit `/dashboard` | Redirected to Home |
| Admin cannot access dashboard as owner | Log in as admin → visit `/dashboard` | Redirected (admin uses `/admin`) |
| Guest browsing | Visit site without login | Can browse salons; booking prompts login |
| Wrong password | Login with bad password | Error message shown |
| Sign up roles | Register as Customer vs Salon Owner | Customer → Home; Owner → Dashboard |

---

### Flow 7 — Bookings page filters

**Goal:** Test booking list UX for both roles.

**As customer (`customer@demo.com`):**

| Step | Action | Expected result |
|---|---|---|
| 1 | Go to **My Bookings** | Cards show salon name, service, date, time |
| 2 | Click **Upcoming** tab | Only future appointments |
| 3 | Click **Past** tab | Completed or past-date bookings |
| 4 | Click **All** tab | Full history |

**As owner (`owner@demo.com`):**

| Step | Action | Expected result |
|---|---|---|
| 1 | Go to **Incoming Bookings** | Cards show **customer name** + service details |
| 2 | Same filter tabs work | Upcoming / Past / All filter correctly |

---

### Flow 8 — Mobile layout

**Goal:** Verify responsive design (Chrome DevTools → toggle device toolbar).

| Screen | What to check |
|---|---|
| **375px (iPhone)** | Bottom nav visible; sidebar hidden; search in mobile header |
| **768px (tablet)** | Layout adapts; cards in 2-column grid |
| **1280px+ (desktop)** | Sidebar nav visible; bottom nav hidden; top search bar full width |

Test on each: Home → Salon detail → Bookings → Login.

---

## API testing (Swagger)

Open **http://localhost:8000/docs** for interactive API testing.

### Quick API checks

```bash
# Health
curl http://localhost:8000/health

# List salons in Mumbai
curl "http://localhost:8000/api/salons?city=Mumbai"

# Login (get token)
curl -X POST http://localhost:8000/api/auth/login \
  -d "username=customer@demo.com&password=password123" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

Use the returned `access_token` as `Authorization: Bearer <token>` for protected endpoints.

| Endpoint | Role required | Quick test |
|---|---|---|
| `GET /api/salons` | None | Returns approved salons only |
| `POST /api/bookings` | Customer | Create booking with salon_id, service_id, slot_id |
| `GET /api/salons/mine` | Owner | Returns owner's salons (any status) |
| `GET /api/admin/salons?status=pending` | Admin | Lists pending salons |
| `PATCH /api/admin/salons/{id}/status?status=approved` | Admin | Approves a salon |

---

## Suggested test order (15-minute demo)

For a quick walkthrough demo to someone new:

1. **Customer browse** (2 min) — Search Mumbai, open Glow Studio  
2. **Customer book** (3 min) — Login, book Haircut, check My Bookings  
3. **Owner dashboard** (3 min) — Login as owner, show services/slots/incoming bookings  
4. **Admin approve** (3 min) — Create new salon as owner → approve as admin → show in search  
5. **Mobile** (2 min) — Resize browser, show bottom nav  

---

## Known limitations (not bugs)

These are intentional MVP gaps — don't file issues for them yet:

- No payment processing (bookings show "Pay at salon")
- No photo uploads for salons (gradient placeholders used)
- No customer review submission UI (reviews API exists, UI pending)
- Owners cannot book appointments (by design — use a customer account)
- One salon per owner dashboard view (first salon shown if multiple exist)
- Render free tier cold starts (~30s after idle)

---

## Resetting test data

To start fresh:

```bash
# Drop and recreate database (Docker)
docker compose down -v
docker compose up -d
cd backend && alembic upgrade head && python scripts/seed.py

# Or re-run seed only (skips if data exists — drop DB first for clean slate)
```

---

## Reporting issues

When filing a bug, include:

1. Role used (customer / owner / admin)
2. Steps to reproduce
3. Expected vs actual behavior
4. Browser and screen size
5. Relevant API response (from Network tab or Swagger)
