"""Validated runtime configuration for the ML service."""

from functools import lru_cache
import os
from typing import Any

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service settings loaded from environment variables prefixed with ``ML_``."""

    model_config = SettingsConfigDict(
        env_prefix="ML_",
        env_file=".env",
        extra="forbid",
        case_sensitive=False,
    )

    service_name: str = Field(default="civiclens-ml", min_length=1)
    environment: str = Field(default="development", min_length=1)
    host: str = Field(default="0.0.0.0", min_length=1)
    port: int = Field(default=8000, ge=1, le=65535)

    def __init__(self, **values: Any) -> None:
        known = {"ML_SERVICE_NAME", "ML_ENVIRONMENT", "ML_HOST", "ML_PORT"}
        unexpected = sorted(key for key in os.environ if key.startswith("ML_") and key not in known)
        if unexpected:
            errors = [
                {"type": "extra_forbidden", "loc": (key,), "input": os.environ[key]}
                for key in unexpected
            ]
            raise ValidationError.from_exception_data(self.__class__.__name__, errors)
        super().__init__(**values)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide validated settings instance."""

    return Settings()
