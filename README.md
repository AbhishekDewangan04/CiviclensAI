# CivicLens AI

CivicLens AI is a civic infrastructure intelligence foundation. The current implementation includes secure citizen authentication, ownership-scoped reporting, a transparent keyword ML baseline, user-scoped analytics, a coordinate-safe City Map, and an AI Insights workspace.

## Scope

- React/Vite frontend with an accessible, responsive CivicLens dashboard shell, City Map, Analytics, and AI Insights sections.
- Express/TypeScript backend with validated configuration, health/readiness endpoints, CORS, safe errors, and tests.
- FastAPI/Python ML service with truthful health/readiness endpoints and tests. No model is installed or loaded.
- JWT-cookie authentication and MongoDB-backed incident persistence when `MONGODB_URI` is configured; deterministic memory repositories are used for tests and local fallback.
- Phase 3 heuristic category suggestions and duplicate candidates through the separate FastAPI service. Submission-time results are stored with incidents when available; these are suggestions only and have no measured production accuracy claim.
- Phase 4 authenticated analytics over available reports: filtered totals, category/status breakdowns, coordinate coverage, and nearby recurring hotspots.
- Phase 5 owner-scoped repair-evidence submission and history with transparent pending-only verification status.
- Phase 7 City Map using Leaflet with actual stored coordinates only, and AI Insights with transparent review-priority factors and evaluation disclosure.

## Prerequisites

- Node.js 22.21.1 (see `.nvmrc`) and npm 10.9.4 or newer.
- Python 3.12 (see `.python-version`). Python 3.14 prerelease is not supported.

## Install

```bash
npm ci
py -3.12 -m venv services/ml/.venv-stable
# Windows: services/ml/.venv-stable/Scripts/activate
# macOS/Linux: python3.12 -m venv services/ml/.venv-stable && source services/ml/.venv-stable/bin/activate
python -m pip install -r services/ml/requirements.txt
```

Copy `.env.example` to `.env` only when local overrides are needed. Vite variables are public; never put backend or ML secrets in `VITE_` variables.

`JWT_SECRET` must be changed outside local development. `MONGODB_URI` enables durable persistence; without it, the backend uses an in-memory repository and data is lost on restart. MongoDB is not bundled by this repository.

Authentication requests are rate-limited in memory using `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX`. This is a local/demo safeguard, not a distributed production rate limiter.

## Run locally

Use three terminals:

```bash
npm run dev:frontend   # http://localhost:5176
npm run dev:backend    # http://localhost:4001
python -m uvicorn app.main:app --app-dir services/ml --reload --port 8000
```

Backend checks are available at `/api/health` and `/api/ready`. ML checks are `/health` and `/ready`.

API groups:

- `/api/auth/*` — registration, login, logout, current user.
- `/api/incidents/*` — authenticated incident CRUD and owner-scoped evidence submission/history.
- `/api/analytics/summary` — authenticated, filtered analytics for the current user's reports.
- `/api/intelligence/suggestions` — authenticated heuristic classification/duplicate suggestions.
- ML `/classify` and `/duplicates` — internal lightweight baseline endpoints.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
python -m compileall -q services/ml/app services/ml/tests
npm run verify
```

The Python tests are run from the repository root and require the ML virtual environment to be active. The full `verify` command intentionally fails if any check fails.

## Architecture

See [docs/architecture.md](docs/architecture.md), [docs/development.md](docs/development.md), and the actual verification record in [docs/phase-1-audit.md](docs/phase-1-audit.md).

## Current limitations

Phase 4 analytics and Phase 7 map/insights reflect only the authenticated user's available reports, not an entire city's infrastructure. The City Map plots only incidents with stored latitude/longitude values; reports without coordinates are shown separately and never assigned guessed locations. Hotspots require coordinates and use a 100 m Haversine grouping threshold. Phase 5 stores evidence image URLs and descriptions, but does not fetch images, perform visual analysis, or provide reviewer approval because no reviewer role exists. Evidence remains pending. Phase 3 uses a reproducible keyword baseline and token similarity only; it does not include model downloads, paid APIs, or calibrated confidence claims. The Phase 6 labeled evaluation set contains 12 hand-authored cases; its 12/12 smoke result is not a production accuracy estimate. Review-priority scores are deterministic triage aids based only on stored status, duplicate suggestions, coordinate presence, and selected category; they are not severity or safety scores. The optional image field is a URL only; the backend does not fetch or store the image.
