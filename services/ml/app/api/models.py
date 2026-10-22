"""Typed response contracts exposed by the service."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok"]
    service: str


class ReadinessResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["unavailable"]
    ready: Literal[False]
    reason: Literal["inference_unavailable"]


class ErrorDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: Literal["not_found"]
    message: Literal["Route not found"]
    path: str


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: ErrorDetail


Description = str


class DescriptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=1, max_length=5000)

    @field_validator("description")
    @classmethod
    def non_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("description must not be blank")
        return value.strip()


class ClassificationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    category: Literal["pothole", "garbage", "water_supply", "streetlight", "drainage", "other"]
    score: float = Field(ge=0, le=1)
    method: Literal["keyword"]


class DuplicateCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    similarity: float = Field(ge=0, le=1)


class DuplicateInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=5000)

    @field_validator("id", "text")
    @classmethod
    def non_blank_fields(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("field must not be blank")
        return value.strip()


class DuplicateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=1, max_length=5000)
    candidates: list[DuplicateInput] = Field(max_length=50)

    @field_validator("description")
    @classmethod
    def non_blank_description(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("description must not be blank")
        return value.strip()


class DuplicateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidates: list[DuplicateCandidate]
