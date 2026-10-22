# CivicLens ML service

A small FastAPI service that gives the CivicLens platform four server-to-server helpers for citizen complaints:

- category suggestion (`/classify`)
- severity grading (`/severity`)
- duplicate detection (`/duplicates`)
- hotspot detection (`/hotspots`)

It is a **deterministic keyword baseline, not a trained model**. It is pure Python, runs fully offline, needs **no API keys**, calls no third-party AI service and downloads no models. It is called server-to-server over HTTPS, so CORS is not enabled.

## Run on Windows (Python 3.12)

From `services\ml`:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m pytest -q
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Interactive docs are served at http://localhost:8000/docs.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ML_SERVICE_NAME` | `civiclens-ml` | Name returned by `/health` |
| `ML_ENVIRONMENT` | `development` | Environment label |
| `ML_HOST` | `0.0.0.0` | Bind host when started with `python -m app.main` |
| `ML_PORT` | `8000` | Bind port when started with `python -m app.main` |
| `ML_API_KEY` | unset | If set and non-empty, protected endpoints require a matching `X-API-Key` header (ASCII keys recommended). If unset or empty, auth is disabled for local development. |

`ML_HOST` and `ML_PORT` are not read by the `uvicorn` command line, which uses its own `--host` and `--port` flags.

## Endpoints

`/health` and `/ready` never require a key. The four POST endpoints require `X-API-Key` when `ML_API_KEY` is set (examples below use `$KEY`). Unknown routes return 404 as `{"detail": {"code": "not_found", "message": "Route not found", "path": "..."}}`.

> In Windows PowerShell, call `curl.exe` (not the `curl` alias) and put the JSON in a file, passing `-d @body.json`, to avoid quoting problems.

**GET /health** returns 200 `{"status": "ok", "service": "civiclens-ml"}`.

```bash
curl http://localhost:8000/health
```

**GET /ready** always returns 503 `{"status": "unavailable", "ready": false, "reason": "inference_unavailable"}`, because only the keyword baseline exists and no ML model is loaded.

```bash
curl -i http://localhost:8000/ready
```

**POST /classify** returns `{"category", "score", "method": "keyword"}`. Categories are `pothole`, `garbage`, `water_supply`, `streetlight`, `drainage` and `other`.

```bash
curl -X POST http://localhost:8000/classify \
  -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"description": "Deep potholes on the main road"}'
```

**POST /severity** returns `{"severity": "low|medium|critical", "score", "signals": [...]}`.

```bash
curl -X POST http://localhost:8000/severity \
  -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"description": "Exposed wire sparking near the school"}'
```

**POST /duplicates** returns up to 5 candidates with `similarity >= 0.3`, best first. Candidates whose category differs from the description's category are excluded. At most 200 candidates.

```bash
curl -X POST http://localhost:8000/duplicates \
  -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"description": "Large pothole on Station Road", "candidates": [{"id": "r1", "text": "Big pothole on Station Road near school"}]}'
```

The service compares text only and has no location awareness. **The caller should pre-filter candidates to reports within about 200 m before calling `/duplicates`.**

**POST /hotspots** returns density clusters (`radius_m` 50-2000, default 300; `min_points` 2-50, default 3; at most 2000 points), most critical and largest first.

```bash
curl -X POST http://localhost:8000/hotspots \
  -H "Content-Type: application/json" -H "X-API-Key: $KEY" \
  -d '{"points": [{"id": "a", "lat": 21.2514, "lng": 81.6296, "severity": "critical"}, {"id": "b", "lat": 21.2516, "lng": 81.6297}, {"id": "c", "lat": 21.2515, "lng": 81.6299}], "radius_m": 300, "min_points": 3}'
```

## Evaluation

`evaluation/classification_cases.json` holds labelled complaints. `tests/test_evaluation.py` requires at least 90% accuracy and lists any misses.