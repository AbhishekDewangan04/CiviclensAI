# Development guide

Run `npm ci` from the repository root and create/activate `services/ml/.venv` before installing its pinned requirements. Keep `.env` files local; only `.env.example` is versioned.

Use `npm run dev:frontend` (`http://localhost:5176`), `npm run dev:backend` (`http://localhost:4001`), and `python -m uvicorn app.main:app --app-dir services/ml --reload --port 8000` in separate terminals. Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before handoff.

## Conventions

- Frontend composition belongs in `src/App.tsx` and feature/components modules; reusable primitives should remain small and accessible.
- Backend routes stay thin. Configuration, middleware, and process startup remain separate.
- ML modules use typed functions and Pydantic models. Do not add model loaders or fake inference results before a concrete Phase 2 requirement.
- Tests live beside the service boundary they exercise.

When debugging, check service ports, the configured frontend origin, browser network errors, and whether the Python virtual environment is active. Do not resolve setup problems by weakening validation or committing local secrets.

## Phase 2 authentication and incidents

Set `JWT_SECRET` and, for durable local data, `MONGODB_URI` in the backend environment. Start MongoDB separately; the repository does not install or manage a database process. The backend exposes `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, and ownership-scoped `/api/incidents` CRUD endpoints. The browser sends credentials with requests, while the HttpOnly JWT cookie remains inaccessible to frontend JavaScript.

Phase 3 intelligence is exposed by the ML service at `/classify` and `/duplicates`, and by the authenticated backend facade at `POST /api/intelligence/suggestions`. Set `ML_SERVICE_BASE_URL` and `ML_TIMEOUT_MS` for the backend. The backend sends only the authenticated user's incident candidates, validates ML responses, stores available submission-time results with incidents, and degrades gracefully when the service is unavailable.

Phase 4 analytics are available at `GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&category=pothole`. `from` is inclusive and `to` is exclusive; date-only `to` values include the named calendar day. The frontend Analytics view sends these filters and renders only returned values. Hotspots require two or more coordinate-bearing reports within 100 meters.

Phase 5 evidence endpoints are `POST /api/incidents/:id/evidence` and `GET /api/incidents/:id/evidence`. Submit an HTTPS/HTTP image URL and description as the incident owner. Evidence receives a server timestamp and `pending` status. Review is intentionally unavailable until a reviewer role is introduced; `POST /api/incidents/:id/evidence/:evidenceId/review` returns `403` rather than granting owner approval privileges.

## Phase 6 hardening

Authentication requests use an in-memory rate limiter controlled by `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX`. Production deployments still require a distributed limiter, secret management, TLS, centralized logging, and dependency/security scanning. MongoDB connection startup uses a bounded five-second server-selection timeout; without MongoDB, the documented local fallback remains in-memory and non-durable. The Phase 6 classifier evaluation is a 12-case hand-authored smoke dataset, not a representative benchmark.

## Phase 7 City Map and AI Insights

The frontend City Map is available from the authenticated sidebar. It uses Leaflet and the owner-scoped incident list, filters by category/status, and plots only real stored coordinates. If a filtered report lacks coordinates, it remains in the count and is explicitly excluded from the map. The map uses OpenStreetMap tiles and does not claim city-wide coverage.

AI Insights is also owner-scoped. It displays stored keyword predictions and token-similarity duplicate suggestions when they exist, distinguishes unavailable ML metadata from valid empty results, and explains that no evidence image contents are inspected. Its review-priority list is a deterministic triage aid, not a severity score; factors are limited to fields already stored on each incident. The evaluation disclosure references the repository's 12-case labeled smoke dataset and must not be presented as production model accuracy.
