import logging

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1 import anatomy, auth, pathology, references, simulations
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.db.session import SessionLocal

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    app = FastAPI(
        title="MEDVERSE API",
        version="0.1.0",
        description=(
            "Anatomical knowledge graph, 3D asset metadata, physiological simulation and "
            "pathology APIs. Educational use only; not a clinical decision-support system."
        ),
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("X-Frame-Options", "DENY")
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response

    install_error_handlers(app)

    v1 = APIRouter(prefix=API_PREFIX)

    @v1.get("/health", tags=["system"])
    def health() -> dict:
        db_ok = True
        try:
            with SessionLocal() as db:
                db.execute(text("SELECT 1"))
        except Exception:  # noqa: BLE001 - health must report, not raise
            db_ok = False
        return {"status": "ok" if db_ok else "degraded", "database": db_ok}

    for module in (auth, anatomy, references, simulations, pathology):
        v1.include_router(module.router)
    app.include_router(v1)
    return app


app = create_app()
