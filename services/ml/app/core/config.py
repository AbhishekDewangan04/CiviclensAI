"""Runtime configuration for the CivicLens ML service."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service settings, overridable through ``ML_``-prefixed environment variables."""

    model_config = SettingsConfigDict(env_prefix="ML_", extra="ignore")

    service_name: str = "civiclens-ml"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000


@lru_cache
def get_settings() -> Settings:
    """Return the cached settings instance."""
    return Settings()