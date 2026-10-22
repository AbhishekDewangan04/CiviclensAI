"""HTTP-level tests for the CivicLens ML service."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _clean_environment(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Run each test with auth disabled, default settings and an empty cache."""
    monkeypatch.delenv("ML_API_KEY", raising=False)
    monkeypatch.delenv("ML_SERVICE_NAME", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# --- health, readiness, errors ---------------------------------------------


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "civiclens-ml"}


def test_health_uses_configured_service_name(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ML_SERVICE_NAME", "other-ml")
    get_settings.cache_clear()
    assert client.get("/health").json()["service"] == "other-ml"


def test_ready_is_always_unavailable() -> None:
    response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "ready": False,
        "reason": "inference_unavailable",
    }


@pytest.mark.parametrize("method", ["get", "post"])
def test_unknown_route_returns_json_404(method: str) -> None:
    response = getattr(client, method)("/nope")
    assert response.status_code == 404
    assert response.json() == {
        "detail": {"code": "not_found", "message": "Route not found", "path": "/nope"}
    }


# --- /classify -------------------------------------------------------------


def test_classify_happy_path() -> None:
    response = client.post("/classify", json={"description": "Potholes and craters on the roads"})
    assert response.status_code == 200
    assert response.json() == {"category": "pothole", "score": 1.0, "method": "keyword"}


def test_classify_strips_whitespace() -> None:
    response = client.post("/classify", json={"description": "  Garbage and trash piled up  "})
    assert response.status_code == 200
    assert response.json()["category"] == "garbage"


def test_classify_other_fallback() -> None:
    response = client.post("/classify", json={"description": "The park gate is broken"})
    assert response.status_code == 200
    assert response.json() == {"category": "other", "score": 0.0, "method": "keyword"}


@pytest.mark.parametrize(
    "payload",
    [{"description": ""}, {"description": "   "}, {}, {"description": "x" * 2001}],
)
def test_classify_rejects_invalid_description(payload: dict[str, str]) -> None:
    assert client.post("/classify", json=payload).status_code == 422


# --- /severity -------------------------------------------------------------


def test_severity_low() -> None:
    response = client.post("/severity", json={"description": "Garbage lying near the road"})
    assert response.status_code == 200
    body = response.json()
    assert body["severity"] == "low"
    assert body["score"] == 1.0
    assert "garbage" in body["signals"]


def test_severity_medium() -> None:
    response = client.post(
        "/severity", json={"description": "The streetlight is not working and the road is dark"}
    )
    body = response.json()
    assert body["severity"] == "medium"
    assert body["score"] == 2.0
    assert {"not working", "dark"} <= set(body["signals"])


def test_severity_critical() -> None:
    response = client.post(
        "/severity", json={"description": "Exposed wire sparking near the school"}
    )
    body = response.json()
    assert body["severity"] == "critical"
    assert body["score"] == 3.0
    assert {"exposed wire", "sparking", "school"} <= set(body["signals"])


def test_severity_rejects_empty_description() -> None:
    assert client.post("/severity", json={"description": ""}).status_code == 422


# --- /duplicates -----------------------------------------------------------


def test_duplicates_same_category_match_and_category_exclusion() -> None:
    payload = {
        "description": "Large pothole on Station Road",
        "candidates": [
            {"id": "1", "text": "Big pothole on Station Road near school"},
            {"id": "2", "text": "Garbage piled on Station Road"},
            {"id": "3", "text": "Completely unrelated text"},
        ],
    }
    response = client.post("/duplicates", json=payload)
    assert response.status_code == 200
    matches = response.json()["candidates"]
    assert [m["id"] for m in matches] == ["1"]
    assert matches[0]["similarity"] == pytest.approx(0.5854, abs=1e-3)


def test_duplicates_limit_of_five() -> None:
    payload = {
        "description": "Pothole on Station Road",
        "candidates": [{"id": f"c{n}", "text": "Pothole on Station Road"} for n in range(7, 0, -1)],
    }
    matches = client.post("/duplicates", json=payload).json()["candidates"]
    assert [m["id"] for m in matches] == ["c1", "c2", "c3", "c4", "c5"]


def test_duplicates_ordering_is_deterministic() -> None:
    texts = {
        "a": "Big pothole on Station Road near school",
        "z": "Pothole on Station Road",
        "b": "Pothole on Station Road",
    }
    payload = {
        "description": "Pothole on Station Road",
        "candidates": [{"id": key, "text": text} for key, text in texts.items()],
    }
    first = client.post("/duplicates", json=payload).json()
    second = client.post("/duplicates", json=payload).json()
    assert first == second
    assert [m["id"] for m in first["candidates"]] == ["b", "z", "a"]


def test_duplicates_accepts_200_and_rejects_201_candidates() -> None:
    def build(count: int) -> dict[str, object]:
        return {
            "description": "Pothole on Station Road",
            "candidates": [{"id": str(n), "text": "Pothole on Station Road"} for n in range(count)],
        }

    assert client.post("/duplicates", json=build(200)).status_code == 200
    assert client.post("/duplicates", json=build(201)).status_code == 422


def test_duplicates_empty_candidates() -> None:
    response = client.post("/duplicates", json={"description": "Pothole", "candidates": []})
    assert response.status_code == 200
    assert response.json() == {"candidates": []}


# --- /hotspots -------------------------------------------------------------


def _geo(pid: str, lat: float, lng: float, severity: str = "low") -> dict[str, object]:
    return {"id": pid, "lat": lat, "lng": lng, "severity": severity}


def test_hotspots_finds_cluster_and_ignores_isolated_point() -> None:
    payload = {
        "points": [
            _geo("p1", 21.2514, 81.6296, "critical"),
            _geo("p2", 21.2516, 81.6297),
            _geo("p3", 21.2515, 81.6299),
            _geo("p4", 21.2513, 81.6295),
            _geo("p5", 21.3514, 81.7296),
        ],
        "radius_m": 300,
        "min_points": 3,
    }
    response = client.post("/hotspots", json=payload)
    assert response.status_code == 200
    hotspots = response.json()["hotspots"]
    assert len(hotspots) == 1
    assert hotspots[0]["count"] == 4
    assert hotspots[0]["report_ids"] == ["p1", "p2", "p3", "p4"]
    assert hotspots[0]["critical_count"] == 1
    assert hotspots[0]["center_lat"] == pytest.approx(21.25145, abs=1e-5)
    assert hotspots[0]["radius_m"] < 100


def test_hotspots_defaults_and_empty_points() -> None:
    response = client.post("/hotspots", json={"points": []})
    assert response.status_code == 200
    assert response.json() == {"hotspots": []}


@pytest.mark.parametrize(
    "payload",
    [
        {"points": [_geo("a", 91, 0)]},
        {"points": [_geo("a", -91, 0)]},
        {"points": [_geo("a", 0, 181)]},
        {"points": [_geo("a", 0, -181)]},
        {"points": [], "radius_m": 10},
        {"points": [], "radius_m": 5000},
        {"points": [], "min_points": 1},
        {"points": [], "min_points": 51},
    ],
)
def test_hotspots_validation_errors(payload: dict[str, object]) -> None:
    assert client.post("/hotspots", json=payload).status_code == 422