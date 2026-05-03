from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    db_url: str = "postgresql+asyncpg://postgres:postgres@oficial_master:5432/oficial"
    db_url_test: str | None = None
    log_level: str = "INFO"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://oficial_dashboard:5173",
        "http://oficial-dashboard:5173",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
