# app/main.py
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .api import themes
from .core import auth as auth_router
from .db import get_db
from .routers import collections as collections_router
from .routers import lists as lists_router
from .routers import reviews as reviews_router
from .routers import sets as sets_router
from .routers import users as users_router

app = FastAPI(title="LEGO API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

@app.get("/")
def root():
    return {"status": "ok", "message": "LEGO API is running"}

# Auth (defines /auth/login, /auth/me, etc inside the router)
app.include_router(auth_router.router, tags=["auth"])

# Sets search + detail (GET /sets, /sets/{set_num}, /sets/{set_num}/rating, /sets/{set_num}/offers, /sets/suggest)
app.include_router(sets_router.router, prefix="/sets", tags=["sets"])

# Reviews (attached under /sets: /sets/{set_num}/reviews, /sets/{set_num}/reviews/me)
app.include_router(reviews_router.router, prefix="/sets", tags=["reviews"])

# Owned / wishlist collections (POST/DELETE/GET under /collections)
app.include_router(collections_router.router, prefix="/collections", tags=["collections"])

# Custom lists
app.include_router(lists_router.router, tags=["lists"])

# Users
app.include_router(users_router.router, tags=["users"])

# Themes
app.include_router(themes.router, tags=["themes"])

@app.get("/db/ping", tags=["debug"])
def db_ping(db: Session = Depends(get_db)):
    return (
        db.execute(text("select current_database() as db, current_user as user"))
        .mappings()
        .one()
    )