# Architecture

## Boundaries

- **Frontend (`apps/frontend`)** owns presentation, accessibility, browser-side health status, and public `VITE_` configuration. It does not own secrets or civic data.
- **Backend (`apps/backend`)** owns HTTP configuration, CORS, request boundaries, authentication, ownership enforcement, incident validation, safe error responses, and health/readiness. `app.ts` is testable construction; `server.ts` owns startup, optional MongoDB connection, and shutdown.
- **ML service (`services/ml`)** is an independent FastAPI process. It reports process health separately from inference readiness. No model or inference endpoint exists in Phase 1.

The backend-to-ML boundary uses explicit HTTP requests with timeouts, Zod response validation, and safe dependency errors. Classification and duplicate suggestions run during report creation and are stored on the incident when available; the user-selected category remains authoritative.

## Phase 2 persistence and identity

Passwords are bcrypt-hashed and never returned. Authentication is a signed JWT stored in an HttpOnly cookie; logout expires that cookie. MongoDB/Mongoose repositories are selected when `MONGODB_URI` is configured. The in-memory repositories are injectable test/local fallbacks and are not durable. Incident queries and mutations always include the authenticated user id; status and role fields are server-controlled.

## Phase 3 intelligence boundary

The FastAPI service owns classification and duplicate similarity algorithms. The backend calls it through `FetchIntelligenceClient` with a configurable timeout and Zod-validated responses. ML failures degrade to an unavailable-suggestions response and do not block incident creation. Duplicate candidates are limited to incidents owned by the authenticated user, and suggestions never merge, delete, or change a selected category/status.

## Phase 4 analytics boundary

`GET /api/analytics/summary` is authenticated and queries only the current user's incidents through the repository's filtered query path. Date and category filters are validated before querying. Aggregation returns counts for the filtered set and groups only incidents with coordinates into 100 m Haversine hotspots; missing coordinates are reported separately and never converted into guessed locations.

## Phase 7 map and insights boundary

The frontend City Map consumes the existing owner-scoped incident list and uses Leaflet to plot only records with actual latitude/longitude values. Category and status filters run on the already authorized dataset. No coordinates are synthesized. AI Insights consumes stored incident intelligence and computes a transparent deterministic review-priority aid from existing status, duplicate suggestions, coordinate presence, and selected category fields. It does not present those factors as severity or safety predictions. The UI discloses the small labeled ML evaluation dataset and does not claim visual image analysis.

## Phase 5 evidence boundary

Repair evidence is stored through an owner-scoped repository and remains `pending`. The current role model contains only `user`, so review requests return `403 REVIEWER_REQUIRED` and cannot approve or reject evidence. The baseline metadata is explicitly `rule_based_text_only` / `image_analysis_unavailable`; no image is fetched or visually analyzed.

## Health and readiness

Health means the HTTP process is alive. Backend readiness reports only Phase 1 configured dependencies and is healthy locally; the ML service returns unavailable because no inference capability is installed. Neither endpoint claims production readiness.

## Configuration and errors

Each service validates its own environment at startup. CORS is an explicit allowlist. JSON payloads have size limits, request logs omit bodies and credentials, malformed JSON has a stable error shape, and production errors do not expose stacks or filesystem paths.

## Dependency choices

React/Vite keeps the shell fast and portable. Leaflet/react-leaflet provide the coordinate map without a proprietary tile dependency. Express provides a small independently testable Node boundary; Zod validates configuration. FastAPI and Pydantic provide typed Python API contracts. Vitest, Supertest, pytest, and HTTPX cover behavior without external services.

## Extension points

Later phases may add richer moderation, live municipal data, notifications, and visual evidence analysis. Each must introduce its own validated boundary and tests rather than turning missing data into fabricated results.
