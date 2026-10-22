"""FastAPI entry point for the CivicLens ML service (keyword baseline)."""

import os
import secrets
from typing import Annotated

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.models import (
    ClassificationResponse,
    DescriptionRequest,
    DuplicateMatch,
    DuplicateRequest,
    DuplicateResponse,
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
    Hotspot,
    HotspotRequest,
    HotspotResponse,
    ReadinessResponse,
    SeverityResponse,
)
from app.core.config import Settings, get_settings
from app.core.intelligence import (
    classify_text,
    find_duplicates,
    find_hotspots,
    grade_severity,
)

app = FastAPI(
    title="CivicLens ML service",
    version="1.0.0",
    description=(
        "Deterministic keyword baseline for category suggestion, severity "
        "grading, duplicate detection and hotspot detection. No trained model "
        "and no external AI service is used."
    ),
)


async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
    """Render unknown routes with the shared ErrorResponse shape."""
    body = ErrorResponse(
        detail=ErrorDetail(code="not_found", message="Route not found", path=request.url.path)
    )
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=body.model_dump())


app.add_exception_handler(404, not_found_handler)


def require_api_key(x_api_key: Annotated[str | None, Header()] = None) -> None:
    """Require a matching ``X-API-Key`` header when ``ML_API_KEY`` is set.

    The environment variable is read on every request. When it is unset or
    empty, authentication is disabled (local development).
    """
    expected = os.getenv("ML_API_KEY", "")
    if not expected:
        return
    provided = x_api_key or ""
    if not secrets.compare_digest(provided.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@app.get("/health", response_model=HealthResponse)
def health(settings: Annotated[Settings, Depends(get_settings)]) -> HealthResponse:
    """Liveness probe."""
    return HealthResponse(status="ok", service=settings.service_name)


@app.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": ReadinessResponse}},
)
def ready(response: Response) -> ReadinessResponse:
    """Readiness probe.

    Always 503: this service is a keyword baseline and no ML model is loaded.
    """
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(status="unavailable", ready=False, reason="inference_unavailable")


@app.post(
    "/classify",
    response_model=ClassificationResponse,
    dependencies=[Depends(require_api_key)],
)
def classify(body: DescriptionRequest) -> ClassificationResponse:
    """Suggest a complaint category using the keyword baseline."""
    category, score = classify_text(body.description)
    return ClassificationResponse(category=category, score=score, method="keyword")


@app.post(
    "/severity",
    response_model=SeverityResponse,
    dependencies=[Depends(require_api_key)],
)
def severity(body: DescriptionRequest) -> SeverityResponse:
    """Grade complaint severity from keyword signals."""
    level, score, signals = grade_severity(body.description)
    return SeverityResponse(severity=level, score=score, signals=signals)


@app.post(
    "/duplicates",
    response_model=DuplicateResponse,
    dependencies=[Depends(require_api_key)],
)
def duplicates(body: DuplicateRequest) -> DuplicateResponse:
    """Return the most similar candidate reports (same category only)."""
    matches = find_duplicates(
        body.description, [candidate.model_dump() for candidate in body.candidates]
    )
    return DuplicateResponse(candidates=[DuplicateMatch(**match) for match in matches])


@app.post(
    "/hotspots",
    response_model=HotspotResponse,
    dependencies=[Depends(require_api_key)],
)
def hotspots(body: HotspotRequest) -> HotspotResponse:
    """Detect dense clusters of reports."""
    clusters = find_hotspots(
        [point.model_dump() for point in body.points], body.radius_m, body.min_points
    )
    return HotspotResponse(hotspots=[Hotspot(**cluster) for cluster in clusters])


def run() -> None:
    """Start uvicorn using the host and port from settings."""
    settings = get_settings()
    uvicorn.run(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    run()