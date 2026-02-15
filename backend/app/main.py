# backend/app/main.py
from __future__ import annotations

import hashlib
import os
import socket
from urllib.parse import quote

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, Response as FastAPIResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core import auth as auth_router
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

app = FastAPI(title="LEGO API")


# ---------------------------
# Debug headers (safe)
# ---------------------------
@app.middleware("http")
async def add_debug_headers(request: Request, call_next):
    resp = await call_next(request)

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
    "https://lego-app-gules.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)


# ---------------------------
# Basic routes
# ---------------------------
@app.get("/", tags=["meta"])
def root():
    return {"status": "ok", "message": "LEGO API is running"}


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


# ---------------------------
# Debug
# ---------------------------
@app.get("/db/ping", tags=["debug"])
def db_ping(db: Session = Depends(get_db)):
    return db.execute(text("select current_database() as db, current_user as user")).mappings().one()