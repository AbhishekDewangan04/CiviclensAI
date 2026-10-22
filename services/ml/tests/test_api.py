from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_contract() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "civiclens-ml"}


def test_readiness_explicitly_reports_inference_unavailable() -> None:
    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "ready": False,
        "reason": "inference_unavailable",
    }


def test_unknown_route_has_predictable_json_contract() -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {
        "detail": {
            "code": "not_found",
            "message": "Route not found",
            "path": "/does-not-exist",
        }
    }


def test_health_response_rejects_extra_fields() -> None:
    from app.api.models import HealthResponse

    response = HealthResponse(status="ok", service="test")

    assert response.model_dump() == {"status": "ok", "service": "test"}


def test_classification_categories_and_fallback() -> None:
    assert client.post("/classify", json={"description": "A huge pothole in the road"}).json()["category"] == "pothole"
    fallback = client.post("/classify", json={"description": "Something unusual happened"})
    assert fallback.status_code == 200 and fallback.json()["category"] == "other"
    assert set(fallback.json()) == {"category", "score", "method"}


def test_duplicates_are_bounded_and_sorted() -> None:
    response = client.post("/duplicates", json={"description": "garbage near Main Road", "candidates": [{"id": str(i), "text": "garbage near Main Road"} for i in range(8)]})
    assert response.status_code == 200
    assert len(response.json()["candidates"]) == 5
    assert response.json()["candidates"][0]["similarity"] == 1


def test_invalid_or_oversized_inputs_are_rejected() -> None:
    assert client.post("/classify", json={"description": ""}).status_code == 422
    assert client.post("/classify", json={"description": "x" * 5001}).status_code == 422
    assert client.post("/duplicates", json={"description": "x", "candidates": [{"id": "x", "text": "x"}] * 51}).status_code == 422
