from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sets as sets_router
from app.routers import reviews as reviews_router

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException as StarletteHTTPException

def create_app() -> FastAPI:
    app = FastAPI(title="LEGO API", version="0.1.0")

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.status_code, "message": exc.detail}},
        )    

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
    app.include_router(reviews_router.router, prefix="/sets", tags=["reviews"])

    return app

{"error": {"code": 404, "message": "Set not found"}}

app = create_app()