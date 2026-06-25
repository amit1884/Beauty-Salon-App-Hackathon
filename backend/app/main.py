from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.mcp.server import mcp
from app.routers import admin, agent, auth, bookings, reviews, salons

app = FastAPI(title="Beauty Salon Marketplace API", version="0.1.0")

if settings.google_api_key:
    import os

    os.environ.setdefault("GOOGLE_API_KEY", settings.google_api_key)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(salons.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(agent.router, prefix="/api")

# MCP server for ADK agents (Streamable HTTP)
app.mount("/mcp", mcp.http_app())


@app.get("/health")
async def health():
    return {"status": "ok"}
