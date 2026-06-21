# SalonBook — Beauty Salon Marketplace

A mobile-friendly marketplace where customers discover salons and book appointments, salon owners manage their business, and admins moderate listings.

Built with **free, open-source tools** and deployable entirely on **free hosting tiers** (Vercel + Render + Neon).

> **Testing the app?** See [TESTING.md](TESTING.md) for feature descriptions and step-by-step test flows.

---

## Features

### Customers
- Browse salons by city, category, or geolocation
- View salon profiles, services, reviews, and pricing
- 3-step booking flow (service → time slot → confirm)
- My Bookings page with upcoming/past filters

### Salon owners
- Owner dashboard to create and manage a salon
- Add services (name, price, duration)
- Manage availability slots (open vs booked)
- View incoming customer bookings with customer names
- Salons go **live in search only after admin approval**

### Admins
- Admin panel to review pending salon listings
- Approve or reject salons before they appear publicly
- Filter salons by status (pending / approved / rejected)

### AI Assistant (Google ADK + MCP)
- Role-aware chat at `/chat` (customer, owner, admin)
- **Google ADK** agents with **Gemini** and **MCP tools** connected to live DB/API data
- **Generative UI** in chat — salon cards, slot pickers, earnings charts, action buttons trigger the next agent turn
- Customer: search salons, book appointments via conversation
- Owner: add salons, view/compare earnings by month/year
- Admin: platform analytics, top clients, pending salon review

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS v4, Framer Motion, Lucide icons |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), Pydantic, Alembic |
| Database | PostgreSQL + PostGIS (geo search) |
| Auth | JWT (self-hosted, bcrypt passwords) |
| AI Agent | Google ADK 2.x, Gemini, FastMCP (MCP server) |
| Local DB | Docker Compose **or** Homebrew PostgreSQL 17 + PostGIS |

---

## Prerequisites

Install these before setting up locally:

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Python** | **3.12** | Required — 3.14 is not supported by all deps |
| **PostgreSQL + PostGIS** | 16+ | Via Docker **or** Homebrew (see below) |
| **Git** | any | To clone the repo |

Optional:
- **Docker Desktop** — easiest way to run PostGIS locally
- **Homebrew** (macOS) — alternative DB setup via `scripts/setup-local.sh`

---

## Project structure

```
beautySalonApp/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment settings
│   │   ├── database.py          # Async SQLAlchemy setup
│   │   ├── models/              # DB models (User, Salon, Booking…)
│   │   ├── schemas/             # Pydantic request/response types
│   │   ├── routers/             # API routes (auth, salons, bookings, admin)
│   │   └── services/            # Auth helpers, role checks
│   ├── alembic/                 # Database migrations
│   ├── scripts/
│   │   ├── seed.py              # Demo data (users, salons, slots)
│   │   └── add_admin.py         # Create admin user if missing
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/               # Home, SalonDetail, Dashboard, Admin…
│   │   ├── components/          # Layout, SalonCard, BookingCard…
│   │   ├── context/             # AuthContext
│   │   └── lib/                 # API client, utilities
│   ├── package.json
│   └── .env.example
├── scripts/
│   └── setup-local.sh           # One-shot macOS/Homebrew DB setup
├── docker-compose.yml           # PostGIS for local dev
└── render.yaml                  # Render.com deploy blueprint
```

---

## Local setup

### Option A — Docker (recommended)

Works on macOS, Linux, and Windows.

**1. Clone and start the database**

```bash
git clone <your-repo-url> beautySalonApp
cd beautySalonApp
docker compose up -d
```

Wait until Postgres is healthy (`docker compose ps`).

**2. Backend**

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python scripts/seed.py
uvicorn app.main:app --reload --port 8000
```

**3. Frontend** (new terminal)

```bash
cd frontend
npm install
npm run dev
```

**4. Open the app**

| URL | Description |
|---|---|
| http://localhost:5173 | Web app |
| http://localhost:8000/docs | Swagger API docs |
| http://localhost:8000/health | Health check |

The Vite dev server proxies `/api` requests to the backend automatically — no extra frontend env vars needed for local dev.

---

### Option B — Homebrew PostgreSQL (macOS)

If you don't use Docker, run the helper script (requires Homebrew PostgreSQL 17 + PostGIS):

```bash
brew install postgresql@17 postgis
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh
```

Then start the app in two terminals:

```bash
# Terminal 1 — API
cd backend && source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

---

## Demo accounts

After running `python scripts/seed.py`, these accounts are available:

| Role | Email | Password | What to try |
|---|---|---|---|
| **Customer** | `customer@demo.com` | `password123` | Browse salons, book appointments |
| **Salon owner** | `owner@demo.com` | `password123` | Owner dashboard, manage services & slots |
| **Admin** | `admin@demo.com` | `password123` | Approve/reject pending salons |

If the admin account is missing (e.g. you seeded before admin was added):

```bash
cd backend && source .venv/bin/activate
PYTHONPATH=. python scripts/add_admin.py
```

---

## User roles explained

```
┌─────────────┐     creates salon      ┌─────────────┐
│ Salon Owner │ ──────────────────────►│   Pending   │
└─────────────┘                        └──────┬──────┘
                                              │ admin approves
                                              ▼
┌─────────────┐     books appointment  ┌─────────────┐
│  Customer   │ ◄──────────────────────│  Approved   │
└─────────────┘                        │   Salon     │
                                       └─────────────┘
```

| Role | Can do | Cannot do |
|---|---|---|
| Customer | Browse, book, review | Create salons, access dashboard |
| Owner | Manage salon, services, slots, view incoming bookings | Book appointments (customer-only) |
| Admin | Approve/reject salons, view all listings | — |

---

## Environment variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql+asyncpg://salon:salon@localhost:5432/salon_marketplace
SECRET_KEY=your-long-random-secret
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=http://localhost:5173
GOOGLE_API_KEY=your-gemini-api-key
LLM_MODEL=gemini-2.0-flash
MCP_SERVER_URL=http://127.0.0.1:8000/mcp
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | Async PostgreSQL connection string (`postgresql+asyncpg://…`) |
| `SECRET_KEY` | JWT signing key — use a long random string in production |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime (default: 7 days) |
| `GOOGLE_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) key for AI chat (free tier) |
| `LLM_MODEL` | Gemini model name for the chat agent (e.g. `gemini-2.0-flash`, `gemini-2.0-flash-lite`) |
| `MCP_SERVER_URL` | Streamable HTTP MCP endpoint (defaults to same server `/mcp`) |

### Frontend (`frontend/.env`)

Only needed for **production** (when API is on a different domain):

```env
VITE_API_URL=https://your-api.onrender.com
```

Leave empty for local dev — Vite proxies to `localhost:8000`.

---

## API overview

Interactive docs: **http://localhost:8000/docs**

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Sign up (customer / owner) |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/salons` | — | List approved salons (city, geo, filters) |
| GET | `/api/salons/{id}` | — | Salon detail |
| GET | `/api/salons/mine` | Owner | Owner's salons (any status) |
| POST | `/api/salons` | Owner | Create salon (starts as pending) |
| POST | `/api/salons/{id}/services` | Owner | Add service |
| GET | `/api/bookings/slots?salon_id=` | — | Available slots |
| POST | `/api/bookings/slots?salon_id=` | Owner | Create time slot |
| POST | `/api/bookings` | Customer | Create booking |
| GET | `/api/bookings/my` | Customer/Owner | My bookings / incoming bookings |
| GET | `/api/admin/salons?status=pending` | Admin | List salons for moderation |
| PATCH | `/api/admin/salons/{id}/status?status=approved` | Admin | Approve or reject salon |
| POST | `/api/agent/chat` | Any logged-in user | AI assistant chat (ADK + MCP) |
| — | `/mcp` | Internal | MCP server (Streamable HTTP) for ADK tools |

---

## Deploy for free

All services below have free tiers sufficient for demos and MVPs.

### 1. Database — [Neon](https://neon.tech)

1. Create a free project
2. In the SQL editor, run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy the connection string and convert to async format:
   ```
   postgresql+asyncpg://user:pass@ep-xxx.neon.tech/salon_marketplace?ssl=require
   ```

### 2. Backend — [Render](https://render.com)

1. Push this repo to GitHub
2. **New → Blueprint** → connect repo (uses `render.yaml`)
3. Set environment variables:
   - `DATABASE_URL` — Neon connection string
   - `CORS_ORIGINS` — your Vercel URL
   - `SECRET_KEY` — random string (Render can auto-generate)
4. Deploy → you get a `*.onrender.com` URL

> Render free tier sleeps after ~15 min idle. First request may take ~30s (cold start).

### 3. Frontend — [Vercel](https://vercel.com)

1. Import repo → set **Root Directory** to `frontend`
2. Add environment variable:
   ```
   VITE_API_URL=https://your-api.onrender.com
   ```
3. Deploy → you get a `*.vercel.app` URL

---

## Troubleshooting

### `ModuleNotFoundError` or pydantic build fails on `pip install`

You're likely on **Python 3.14**. Use **Python 3.12**:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Database connection refused

**Docker:** ensure the container is running:
```bash
docker compose up -d
docker compose ps
```

**Homebrew:** ensure PostgreSQL is started:
```bash
brew services start postgresql@17
pg_isready -h localhost -p 5432
```

### PostGIS extension not found

**Docker:** PostGIS is included in the `postgis/postgis` image automatically.

**Homebrew:** install PostGIS linked to your Postgres version:
```bash
brew install postgis
psql -d salon_marketplace -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Salon stuck on "Pending approval"

Log in as admin and approve it:
```
admin@demo.com / password123
→ Admin Panel → Pending → Approve
```

### Frontend can't reach API in production

Set `VITE_API_URL` in Vercel to your Render backend URL (no trailing slash).
Ensure `CORS_ORIGINS` on the backend includes your Vercel domain.

---

## Development commands

```bash
# Run DB migrations after model changes
cd backend && alembic revision --autogenerate -m "description"
alembic upgrade head

# Re-seed demo data (skips if already seeded)
PYTHONPATH=. python scripts/seed.py

# Frontend production build
cd frontend && npm run build

# Frontend lint
cd frontend && npm run lint
```

---

## Roadmap

- [x] Database schema, CRUD APIs, JWT auth
- [x] Customer browse, search, booking flow
- [x] Owner dashboard (salon, services, slots)
- [x] Admin approval panel
- [x] Role-based UI (customer / owner / admin)
- [ ] Payment integration (Razorpay / Stripe test mode)
- [ ] Customer review submission UI
- [ ] Salon photo uploads
- [ ] AI-powered search & recommendations (Google ADK)

---

## License

MIT — all dependencies are open source.
