"""FastAPI entry point for the Phase 1 ML service."""

import math
import re
from collections import Counter
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.api.models import (ClassificationResponse, DescriptionRequest, DuplicateRequest,
                            DuplicateResponse, ErrorDetail, ErrorResponse, HealthResponse,
                            ReadinessResponse)
from app.core.config import get_settings


settings = get_settings()
app = FastAPI(title="CivicLens ML Service", version="0.1.0")


@app.get("/health", response_model=HealthResponse, status_code=status.HTTP_200_OK)
def health() -> HealthResponse:
    """Report that the HTTP process is alive."""

    return HealthResponse(status="ok", service=settings.service_name)


@app.get("/ready", response_model=ReadinessResponse, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)
def readiness() -> ReadinessResponse:
    """Report that inference is intentionally unavailable in Phase 1."""

    return ReadinessResponse(
        status="unavailable",
        ready=False,
        reason="inference_unavailable",
    )


KEYWORDS = {
    "pothole": {"pothole", "road", "roadway", "crater"},
    "garbage": {"garbage", "trash", "waste", "dump", "litter"},
    "water_supply": {"water", "pipe", "leak", "supply", "tap"},
    "streetlight": {"light", "streetlight", "lamp", "dark", "bulb"},
    "drainage": {"drain", "drainage", "sewer", "flood", "waterlogging"},
}


def tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


@app.post("/classify", response_model=ClassificationResponse)
def classify(payload: DescriptionRequest) -> ClassificationResponse:
    words = Counter(tokens(payload.description))
    scores = {category: sum(words[word] for word in terms) for category, terms in KEYWORDS.items()}
    category, score = max(scores.items(), key=lambda item: (item[1], item[0]))
    if score == 0:
        return ClassificationResponse(category="other", score=0.0, method="keyword")
    return ClassificationResponse(category=category, score=min(1.0, score / max(3, len(words))), method="keyword")


@app.post("/duplicates", response_model=DuplicateResponse)
def duplicates(payload: DuplicateRequest) -> DuplicateResponse:
    query = Counter(tokens(payload.description))
    results = []
    for candidate in payload.candidates:
        other = Counter(tokens(candidate.text))
        intersection = set(query) & set(other)
        union = set(query) | set(other)
        jaccard = len(intersection) / len(union) if union else 0.0
        dot = sum(query[word] * other[word] for word in intersection)
        cosine = dot / (math.sqrt(sum(value * value for value in query.values())) * math.sqrt(sum(value * value for value in other.values()))) if query and other else 0.0
        similarity = round((jaccard + cosine) / 2, 4)
        if similarity >= 0.2:
            results.append({"id": candidate.id, "similarity": similarity})
    results.sort(key=lambda item: (-item["similarity"], item["id"]))
    return DuplicateResponse(candidates=results[:5])


@app.exception_handler(404)
async def not_found_handler(request: Request, _exc: Exception) -> JSONResponse:
    """Return one stable JSON shape for every unknown route."""

    payload = ErrorResponse(
        detail=ErrorDetail(
            code="not_found",
            message="Route not found",
            path=request.url.path,
        )
    )
    return JSONResponse(status_code=404, content=payload.model_dump())
