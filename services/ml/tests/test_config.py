"""Tests for app.core.config."""

from collections.abc import Iterator

import pytest

from app.core.config import Settings, get_settings

_ENV_NAMES = ("ML_SERVICE_NAME", "ML_ENVIRONMENT", "ML_HOST", "ML_PORT")


@pytest.fixture(autouse=True)
def _fresh_settings(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Start every test without ML_ variables and with an empty settings cache."""
    for name in _ENV_NAMES:
        monkeypatch.delenv(name, raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_defaults() -> None:
    settings = get_settings()
    assert settings.service_name == "civiclens-ml"
    assert settings.environment == "development"
    assert settings.host == "0.0.0.0"
    assert settings.port == 8000


def test_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_SERVICE_NAME", "custom-ml")
    monkeypatch.setenv("ML_ENVIRONMENT", "production")
    monkeypatch.setenv("ML_HOST", "127.0.0.1")
    monkeypatch.setenv("ML_PORT", "9001")
    settings = get_settings()
    assert settings.service_name == "custom-ml"
    assert settings.environment == "production"
    assert settings.host == "127.0.0.1"
    assert settings.port == 9001


def test_get_settings_is_cached() -> None:
    assert get_settings() is get_settings()


def test_cache_clear_picks_up_new_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    assert get_settings().service_name == "civiclens-ml"
    monkeypatch.setenv("ML_SERVICE_NAME", "changed")
    assert get_settings().service_name == "civiclens-ml"
    get_settings.cache_clear()
    assert get_settings().service_name == "changed"


def test_settings_class_reads_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_PORT", "8123")
    assert Settings().port == 8123