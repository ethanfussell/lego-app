from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sets as sets_router

def create_app() -> FastAPI:
    app = FastAPI(title="LEGO API", version="0.1.0")

    # CORS for local frontend (we can tighten later)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"ok": True}

    # Mount routers
    app.include_router(sets_router.router, prefix="/sets", tags=["sets"])

    return app

app = create_app()