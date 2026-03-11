# backend/app/main.py
from __future__ import annotations

import hashlib
import os
import socket
from contextlib import asynccontextmanager
from urllib.parse import quote

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, Response as FastAPIResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select, text, func
from sqlalchemy.orm import Session

from app.core import auth as auth_router
from app.core.limiter import limiter
from app.db import get_db
from app.models import List as ListModel
from app.models import Set as SetModel
from app.routers import collections as collections_router
from app.routers import lists as lists_router
from app.routers import ratings
from app.routers import review_stats as review_stats_router
from app.routers import reviews as reviews_router
from app.routers import sets as sets_router
from app.routers import themes as themes_router
from app.routers import users as users_router
from app.routers.offers import router as offers_router
from app.routers import email_signups as email_signups_router
from app.routers import affiliate_clicks
from app.routers import admin as admin_router
from app.routers import reports as reports_router
from app.routers import alerts as alerts_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    import threading
    from app.core.scheduler import start_scheduler, shutdown_scheduler
    start_scheduler()

    # Run retirement scraper once on startup (in background thread to not block)
    def _startup_scrape():
        try:
            from app.pipelines.retirement_scraper import run_retirement_scrape
            import logging
            logger = logging.getLogger("bricktrack.startup")
            logger.info("Running retirement scraper on startup...")
            result = run_retirement_scrape()
            logger.info("Startup retirement scrape result: %s", result)
        except Exception:
            import logging
            logging.getLogger("bricktrack.startup").exception("Startup retirement scrape failed")

    threading.Thread(target=_startup_scrape, daemon=True).start()

    yield
    shutdown_scheduler()


app = FastAPI(title="BrickTrack API", lifespan=lifespan)

# Reject weak SECRET_KEY in production
_is_production = os.getenv("ENVIRONMENT", "").lower() == "production"
if _is_production:
    _secret = os.getenv("SECRET_KEY", "")
    if not _secret or _secret == "change-me-in-production" or len(_secret) < 16:
        raise RuntimeError("SECRET_KEY must be set to a strong value in production (min 16 chars)")

# ---------------------------
# Rate limiting
# ---------------------------
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# ---------------------------
# Security + debug headers
# ---------------------------
_is_production = os.getenv("RENDER") is not None  # Render sets this automatically


@app.middleware("http")
async def add_headers(request: Request, call_next):
    resp = await call_next(request)

    # Security headers — prevent clickjacking, MIME sniffing, XSS
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["X-XSS-Protection"] = "1; mode=block"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.clerk.com; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://api.clerk.com https://*.clerk.accounts.dev; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )

    # Cache headers for read-only GET endpoints
    # Skip auth-sensitive routes, admin, and user-specific endpoints
    if request.method == "GET" and resp.status_code < 400:
        path = request.url.path
        _no_cache_prefixes = (
            "/admin", "/collections/me", "/auth", "/reviews/me",
            "/lists/me", "/db/", "/health",
        )
        has_auth = "authorization" in request.headers

        if not any(path.startswith(p) for p in _no_cache_prefixes):
            if has_auth:
                # Authenticated user: private cache, shorter TTL
                resp.headers.setdefault(
                    "Cache-Control", "private, max-age=60"
                )
            else:
                # Public data: CDN-cacheable, 5 min fresh + serve stale up to 1 hr
                resp.headers.setdefault(
                    "Cache-Control",
                    "public, max-age=300, s-maxage=300, stale-while-revalidate=3600"
                )

    # Debug headers (only in dev, not production)
    if not _is_production:
        secret = (os.getenv("SECRET_KEY") or "").encode("utf-8")
        kid = hashlib.sha256(secret).hexdigest()[:8] if secret else "none"
        resp.headers["x-secret-kid"] = kid
        resp.headers["x-host"] = socket.gethostname()
        resp.headers["x-git-sha"] = (os.getenv("RENDER_GIT_COMMIT") or "local")[:7]

    return resp


# ---------------------------
# CORS
# ---------------------------
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://bricktrack.com",
    "https://www.bricktrack.com",
    "https://lego-app-gules.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https:\/\/lego-app[a-z0-9-]*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    expose_headers=["X-Total-Count"],
)


# ---------------------------
# Basic routes
# ---------------------------
@app.get("/", tags=["meta"])
def root():
    return {"status": "ok", "message": "BrickTrack API is running"}


@app.get("/health", tags=["meta"])
def health():
    return {"ok": True}


# ---------------------------
# SEO basics
# ---------------------------
def _public_base_url(request: Request) -> str:
    env = (os.getenv("PUBLIC_BASE_URL") or "").strip()
    if env:
        return env.rstrip("/")
    return str(request.base_url).rstrip("/")


@app.get("/robots.txt", include_in_schema=False)
def robots_txt(request: Request):
    base = _public_base_url(request)
    body = f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n"
    return PlainTextResponse(content=body, media_type="text/plain")


@app.get("/sitemap.xml", include_in_schema=False)
def sitemap_xml(request: Request, db: Session = Depends(get_db)):
    base = _public_base_url(request)
    urls: list[str] = []

    urls.append(f"{base}/")
    urls.append(f"{base}/lists/public")

    theme_rows = (
        db.execute(
            select(SetModel.theme)
            .where(SetModel.theme.is_not(None), func.length(func.trim(SetModel.theme)) > 0)
            .group_by(SetModel.theme)
            .order_by(SetModel.theme.asc())
            .limit(5000)
        )
        .scalars()
        .all()
    )
    for t in theme_rows:
        urls.append(f"{base}/themes/{quote(str(t))}")

    list_rows = (
        db.execute(
            select(ListModel.id)
            .where(ListModel.is_public.is_(True))
            .order_by(ListModel.created_at.desc())
            .limit(5000)
        )
        .scalars()
        .all()
    )
    for lid in list_rows:
        urls.append(f"{base}/lists/{int(lid)}")

    set_rows = (
        db.execute(select(SetModel.set_num).order_by(SetModel.set_num.asc()).limit(5000))
        .scalars()
        .all()
    )
    for sn in set_rows:
        urls.append(f"{base}/sets/{quote(str(sn))}")

    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for u in urls:
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{u}</loc>")
        xml_lines.append("  </url>")
    xml_lines.append("</urlset>")

    return FastAPIResponse(content="\n".join(xml_lines), media_type="application/xml")


# ---------------------------
# Routers
# ---------------------------
app.include_router(auth_router.router, tags=["auth"])

# sets + reviews (reviews router is mounted under /sets)
app.include_router(sets_router.router, prefix="/sets", tags=["sets"])
app.include_router(reviews_router.router, prefix="/sets", tags=["reviews"])

app.include_router(collections_router.router, prefix="/collections", tags=["collections"])
app.include_router(users_router.router, tags=["users"])

# themes router already has prefix="/themes" inside it
app.include_router(themes_router.router)

# lists router already has prefix="/lists"
app.include_router(lists_router.router)

# review stats (keeps multiple mount points working)
app.include_router(review_stats_router.router)  # /reviews/me/stats (etc)
app.include_router(review_stats_router.router, prefix="/sets", tags=["reviews"])  # /sets/reviews/me/stats
app.include_router(review_stats_router.router, prefix="/reviews", tags=["reviews"])
app.include_router(review_stats_router.router, prefix="/sets/reviews", tags=["reviews"])

app.include_router(ratings.router)
app.include_router(offers_router)

app.include_router(email_signups_router.router)


# ---------------------------
# Debug (dev only)
# ---------------------------
if not _is_production:
    @app.get("/db/ping", tags=["debug"])
    def db_ping(db: Session = Depends(get_db)):
        return db.execute(text("select current_database() as db, current_user as user")).mappings().one()


# ---------------------------
# Affiliate
# ---------------------------
app.include_router(affiliate_clicks.router)
app.include_router(admin_router.router)
app.include_router(reports_router.router)
app.include_router(alerts_router.router)