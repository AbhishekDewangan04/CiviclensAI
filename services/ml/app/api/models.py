"""Pydantic request and response models for the CivicLens ML service."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

Description = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2000),
]


class DescriptionRequest(BaseModel):
    """A single citizen complaint description."""

    description: Description


class Candidate(BaseModel):
    """An existing report that may duplicate the incoming complaint."""

    id: str
    text: str


class DuplicateRequest(BaseModel):
    """A complaint description plus the candidate reports to compare it with."""

    description: Description
    candidates: list[Candidate] = Field(max_length=200)


class ClassificationResponse(BaseModel):
    """Suggested category with a confidence score."""

    category: str
    score: float
    method: str


class DuplicateMatch(BaseModel):
    """A candidate report that looks like a duplicate."""

    id: str
    similarity: float


class DuplicateResponse(BaseModel):
    """Duplicate candidates ordered by descending similarity."""

    candidates: list[DuplicateMatch]


class SeverityResponse(BaseModel):
    """Severity grade with the signals that produced it."""

    severity: Literal["low", "medium", "critical"]
    score: float
    signals: list[str]


class GeoPoint(BaseModel):
    """A geolocated report."""

    id: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    severity: str = "low"


class HotspotRequest(BaseModel):
    """Points to cluster plus the clustering parameters."""

    points: list[GeoPoint] = Field(max_length=2000)
    radius_m: float = Field(default=300, ge=50, le=2000)
    min_points: int = Field(default=3, ge=2, le=50)


class Hotspot(BaseModel):
    """A dense cluster of reports."""

    center_lat: float
    center_lng: float
    count: int
    radius_m: float
    report_ids: list[str]
    critical_count: int


class HotspotResponse(BaseModel):
    """Detected hotspots, most severe first."""

    hotspots: list[Hotspot]


class HealthResponse(BaseModel):
    """Liveness response."""

    status: str
    service: str


class ReadinessResponse(BaseModel):
    """Readiness response."""

    status: str
    ready: bool
    reason: str | None = None


class ErrorDetail(BaseModel):
    """Machine-readable error description."""

    code: str
    message: str
    path: str | None = None


class ErrorResponse(BaseModel):
    """Envelope for error responses produced by this service."""

    detail: ErrorDetail