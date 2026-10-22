import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_config_reads_prefixed_environment_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_SERVICE_NAME", "test-ml")
    monkeypatch.setenv("ML_PORT", "9001")

    settings = Settings()

    assert settings.service_name == "test-ml"
    assert settings.port == 9001


def test_config_rejects_invalid_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_PORT", "70000")

    with pytest.raises(ValidationError):
        Settings()


def test_config_rejects_unknown_environment_variables(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_UNEXPECTED", "value")

    with pytest.raises(ValidationError):
        Settings()
