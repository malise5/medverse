import os
import uuid

# Must be set before any app module reads settings.
os.environ.setdefault(
    "MEDVERSE_DATABASE_URL",
    "postgresql+psycopg://medverse:medverse_dev_password@localhost:5432/medverse_test",
)
os.environ["MEDVERSE_ENV"] = "test"
os.environ["MEDVERSE_REDIS_URL"] = ""  # in-memory rate limiting for deterministic tests

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core.config import BACKEND_DIR, get_settings  # noqa: E402
from app.core.rate_limit import get_rate_limiter  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed.loader import run_seed  # noqa: E402

PASSWORD = "Correct-Horse-42!"


@pytest.fixture(scope="session", autouse=True)
def database():
    assert "test" in str(engine.url.database), "Refusing to run tests against a non-test database"
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")
    with SessionLocal() as db:
        run_seed(db, get_settings().content_dir)
    yield


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def client():
    get_rate_limiter().reset()
    with TestClient(app) as c:
        yield c


def register(client: TestClient, email: str | None = None) -> dict:
    email = email or f"user-{uuid.uuid4().hex[:10]}@example.org"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Test User", "password": PASSWORD},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def auth_client(client):
    """A client holding a fresh student session cookie."""
    register(client)
    return client
