# backend/app/main.py
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, Response as FastAPIResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from urllib.parse import quote
import os

from .api import themes
from .core import auth as auth_router
from .db import get_db
from .models import Set as SetModel
from .models import List as ListModel
from .routers import collections as collections_router
from .routers import lists as lists_router
from .routers import reviews as reviews_router
from .routers import sets as sets_router
from .routers import users as users_router
from .routers import review_stats as review_stats_router
from .routers import ratings

app = FastAPI(title="LEGO API")

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", 
                   "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],             # includes DELETE + OPTIONS
    allow_headers=["*"],             # includes Authorization
    expose_headers=["X-Total-Count"] # optional if you use that header
)

# ---- basic routes ----
@app.get("/", tags=["meta"])
def root():
    return {"status": "ok", "message": "LEGO API is running"}

@app.get("/health", tags=["meta"])
def health():
    return {"ok": True}

# ---- SEO basics ----

def _public_base_url(request: Request) -> str:
    """
    Prefer PUBLIC_BASE_URL (prod), fall back to request base URL (dev/tests).
    Example PUBLIC_BASE_URL: https://yourdomain.com
    """
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

    # ---- Collect URLs (cap to keep sitemap reasonable for now) ----
    urls: list[str] = []

    # Home + primary discovery routes (frontend should implement these)
    urls.append(f"{base}/")
    urls.append(f"{base}/lists/public")  # if your frontend has a public lists page

    # Themes (derived from sets.theme)
    theme_rows = db.execute(
        select(SetModel.theme)
        .where(SetModel.theme.isnot(None), SetModel.theme != "")
        .group_by(SetModel.theme)
        .order_by(SetModel.theme.asc())
        .limit(5000)
    ).scalars().all()

    for t in theme_rows:
        urls.append(f"{base}/themes/{quote(str(t))}")

    # Public lists
    list_rows = db.execute(
        select(ListModel.id)
        .where(ListModel.is_public.is_(True))
        .order_by(ListModel.created_at.desc())
        .limit(5000)
    ).scalars().all()

    for lid in list_rows:
        urls.append(f"{base}/lists/{int(lid)}")

    # Optional: include a capped set list (expand later with sitemap index if needed)
    set_rows = db.execute(
        select(SetModel.set_num)
        .order_by(func.coalesce(ListModel.updated_at, ListModel.created_at).desc(), ListModel.id.desc())
        .limit(5000)
    ).scalars().all()

    for sn in set_rows:
        urls.append(f"{base}/sets/{quote(str(sn))}")

    # ---- Render XML ----
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

# ---- routers ----
app.include_router(auth_router.router, tags=["auth"])

app.include_router(sets_router.router, prefix="/sets", tags=["sets"])
app.include_router(reviews_router.router, prefix="/sets", tags=["reviews"])

app.include_router(collections_router.router, prefix="/collections", tags=["collections"])
app.include_router(users_router.router, tags=["users"])
app.include_router(themes.router, tags=["themes"])

app.include_router(lists_router.router)  # lists router already has prefix="/lists"

app.include_router(review_stats_router.router)
app.include_router(ratings.router)

# ---- debug ----
@app.get("/db/ping", tags=["debug"])
def db_ping(db: Session = Depends(get_db)):
    return (
        db.execute(text("select current_database() as db, current_user as user"))
        .mappings()
        .one()
    )
