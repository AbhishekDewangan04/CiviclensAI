"""Tests for the optional X-API-Key authentication."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

PROTECTED: list[tuple[str, dict[str, object]]] = [
    ("/classify", {"description": "pothole on the road"}),
    ("/severity", {"description": "pothole on the road"}),
    ("/duplicates", {"description": "pothole", "candidates": []}),
    ("/hotspots", {"points": []}),
]
IDS = [path for path, _ in PROTECTED]


@pytest.mark.parametrize(("path", "payload"), PROTECTED, ids=IDS)
def test_auth_disabled_when_key_unset(
    monkeypatch: pytest.MonkeyPatch, path: str, payload: dict[str, object]
) -> None:
    monkeypatch.delenv("ML_API_KEY", raising=False)
    assert client.post(path, json=payload).status_code == 200


@pytest.mark.parametrize(("path", "payload"), PROTECTED, ids=IDS)
def test_auth_disabled_when_key_empty(
    monkeypatch: pytest.MonkeyPatch, path: str, payload: dict[str, object]
) -> None:
    monkeypatch.setenv("ML_API_KEY", "")
    assert client.post(path, json=payload).status_code == 200


@pytest.mark.parametrize(("path", "payload"), PROTECTED, ids=IDS)
def test_missing_key_is_rejected(
    monkeypatch: pytest.MonkeyPatch, path: str, payload: dict[str, object]
) -> None:
    monkeypatch.setenv("ML_API_KEY", "s3cret")
    response = client.post(path, json=payload)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing API key"}


@pytest.mark.parametrize(("path", "payload"), PROTECTED, ids=IDS)
def test_wrong_key_is_rejected(
    monkeypatch: pytest.MonkeyPatch, path: str, payload: dict[str, object]
) -> None:
    monkeypatch.setenv("ML_API_KEY", "s3cret")
    response = client.post(path, json=payload, headers={"X-API-Key": "nope"})
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid or missing API key"}


@pytest.mark.parametrize(("path", "payload"), PROTECTED, ids=IDS)
def test_correct_key_is_accepted(
    monkeypatch: pytest.MonkeyPatch, path: str, payload: dict[str, object]
) -> None:
    monkeypatch.setenv("ML_API_KEY", "s3cret")
    response = client.post(path, json=payload, headers={"X-API-Key": "s3cret"})
    assert response.status_code == 200


def test_health_and_ready_stay_open_when_key_is_set(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_API_KEY", "s3cret")
    assert client.get("/health").status_code == 200
    assert client.get("/ready").status_code == 503


def test_key_is_read_at_request_time(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"description": "pothole"}
    monkeypatch.delenv("ML_API_KEY", raising=False)
    assert client.post("/classify", json=payload).status_code == 200
    monkeypatch.setenv("ML_API_KEY", "later")
    assert client.post("/classify", json=payload).status_code == 401