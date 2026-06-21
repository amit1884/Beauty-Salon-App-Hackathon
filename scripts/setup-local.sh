#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="/opt/homebrew/opt/postgresql@17/bin"
export PATH="$PG_BIN:$PATH"

echo "==> Starting PostgreSQL 17..."
brew services stop postgresql@14 postgresql@16 2>/dev/null || true
brew services start postgresql@17 2>/dev/null || true
sleep 2

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL is not running on port 5432."
  echo "Try: brew services restart postgresql@17"
  exit 1
fi

echo "==> Creating database and user..."
psql -d postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='salon'" | grep -q 1 || \
  psql -d postgres -c "CREATE USER salon WITH PASSWORD 'salon' CREATEDB;"
psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='salon_marketplace'" | grep -q 1 || \
  psql -d postgres -c "CREATE DATABASE salon_marketplace OWNER salon;"
psql -d salon_marketplace -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -d salon_marketplace -c "GRANT ALL ON SCHEMA public TO salon;"

echo "==> Backend setup..."
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3.12 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env

echo "==> Running migrations..."
alembic upgrade head

echo "==> Seeding demo data..."
PYTHONPATH=. python scripts/seed.py

echo ""
echo "✓ Database ready!"
echo ""
echo "Start the app in two terminals:"
echo "  Terminal 1: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "  App:  http://localhost:5173"
echo "  API:  http://localhost:8000/docs"
echo "  Demo: customer@demo.com / password123"
