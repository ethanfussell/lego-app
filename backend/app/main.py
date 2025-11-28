# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 🔐 auth router (fake login + /auth/me)
from app.core import auth as auth_router

# Other routers
from app.routers import sets as sets_router
from app.routers import reviews as reviews_router
from app.routers import custom_collections as collections_router
from app.routers import lists as lists_router
from app.routers import users as users_router

app = FastAPI(title="LEGO API")

# --- CORS so frontend (file:// or http://localhost) can talk to backend ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # later you can tighten this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

# --- Simple health/root endpoint ---
@app.get("/")
def root():
    return {"status": "ok", "message": "LEGO API is running"}

# --- Routers ---
# Auth (login + current user)
app.include_router(auth_router.router)

# Sets search + detail
app.include_router(sets_router.router, prefix="/sets", tags=["sets"])

# Reviews (e.g. /sets/{set_num}/reviews)
app.include_router(reviews_router.router, prefix="/sets", tags=["reviews"])

# Owned / wishlist collections
app.include_router(collections_router.router, tags=["collections"])

# Custom lists (e.g. /lists/...)
app.include_router(lists_router.router, prefix="/lists", tags=["lists"])

# Public user profile
app.include_router(users_router.router, tags=["users"])