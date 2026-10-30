from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables prefixed MEDVERSE_."""

    model_config = SettingsConfigDict(env_prefix="MEDVERSE_", env_file=".env", extra="ignore")

    env: Literal["development", "test", "production"] = "development"
    database_url: str = (
        "postgresql+psycopg://medverse:medverse_dev_password@localhost:5432/medverse"
    )
    redis_url: str | None = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]

    session_cookie_name: str = "mv_session"
    session_ttl_hours: int = 12
    cookie_secure: bool = False

    # Login rate limit: attempts per window per (ip, email) pair.
    login_rate_limit: int = 10
    login_rate_window_seconds: int = 300

    content_dir: Path = BACKEND_DIR.parent / "content"

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
