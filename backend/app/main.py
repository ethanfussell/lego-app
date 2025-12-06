# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 🔐 auth router (fake login + /auth/me)
from .core import auth as auth_router

# Other routers
from .routers import sets as sets_router
from .routers import reviews as reviews_router
from .routers import custom_collections as collections_router
from .routers import lists as lists_router
from .routers import users as users_router

app = FastAPI(title="LEGO API")

# --- CORS so frontend (http://localhost:3000) can talk to backend ---
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # later you can tighten this or add prod URL
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

# Sets search + detail → /sets/...
app.include_router(sets_router.router, prefix="/sets", tags=["sets"])

# Reviews → routes in reviews.py are like /sets/{set_num}/reviews, /sets/{set_num}/rating
# so we DO NOT add another /sets prefix here
app.include_router(reviews_router.router, tags=["reviews"])

# Owned / wishlist collections → /collections/...
app.include_router(
    collections_router.router,
    prefix="/collections",
    tags=["collections"],
)

# Custom lists → /lists/...
app.include_router(lists_router.router, prefix="/lists", tags=["lists"])

# Public user profile → /users/...
app.include_router(users_router.router, tags=["users"])