# CivicLens backend

Express + TypeScript REST API for CivicLens AI, a civic-complaint platform. Citizens file reports (potholes, garbage, water supply, streetlights, drainage). The API stores them, enriches each new report by calling a separate Python ML service (category, severity, duplicates, hotspots), and serves stats, hotspots and a rule-based briefing. It uses no LLM and no third-party AI API.

## Setup (Windows 11, Node.js 20+)

```powershell
cd apps\backend
npm install
Copy-Item .env.example .env
npm run dev
```

The server listens on http://localhost:3001. Other scripts: `npm start`, `npm run typecheck`, `npm test`.

`.env` is read from the current directory at startup. Real environment variables win over `.env`. Keep `.env` to plain `KEY=VALUE` lines with no inline comments.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | HTTP port |
| `NODE_ENV` | `development` | `development`, `production` or `test` |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins |
| `ML_BASE_URL` | `http://localhost:8000` | Python ML service |
| `ML_API_KEY` | (unset) | Sent as `X-API-Key` when set |
| `ML_TIMEOUT_MS` | `2000` | Timeout per ML call |
| `DATA_FILE` | `./data/reports.json` | JSON persistence file |

Invalid values stop the server at startup with a message naming the variable.

## Endpoints

Errors always look like `{ "error": { "code": "...", "message": "..." } }` (400, 403, 404, 409, 413, 429, 500).

`reporter_key` is the credential a device uses to resolve its own reports. It is never returned. Responses carry `is_mine` instead, computed from your `X-Reporter-Key` header (16-128 characters; pick a random string once per device and keep it).

PowerShell examples (`curl.exe`, not the `curl` alias):

```powershell
$key = "demo-reporter-key-0123456789"
```

**Health**

```powershell
curl.exe http://localhost:3001/health
```

**Create a report** (requires `X-Reporter-Key`)

```powershell
'{"description":"Large pothole near the market","lat":21.2514,"lng":81.6296}' |
  curl.exe -X POST http://localhost:3001/reports -H "Content-Type: application/json" -H "X-Reporter-Key: $key" --data-binary "@-"
```

Returns `201 { report, duplicates: [{id, similarity}], ml_status }`. `image_url` is optional and must be http(s).

**List reports**

```powershell
curl.exe "http://localhost:3001/reports?status=open&category=pothole&severity=critical&limit=50&offset=0"
curl.exe "http://localhost:3001/reports?mine=true" -H "X-Reporter-Key: $key"
curl.exe "http://localhost:3001/reports?bbox=81.5,21.1,81.8,21.4"
```

Query: `status`, `category`, `severity`, `mine=true`, `bbox=minLng,minLat,maxLng,maxLat`, `limit` (default 100, max 500), `offset`. Newest first. Returns `{ reports, total }`. `mine=true` without a key returns nothing.

**Stats**

```powershell
curl.exe http://localhost:3001/reports/stats
```

**One report**

```powershell
curl.exe http://localhost:3001/reports/<id> -H "X-Reporter-Key: $key"
```

**Resolve or reopen your own report**

```powershell
'{"action":"resolve"}' |
  curl.exe -X POST http://localhost:3001/reports/<id>/action -H "Content-Type: application/json" -H "X-Reporter-Key: $key" --data-binary "@-"
```

Returns `{ report }`. 403 for another device's report, 409 `invalid_transition` when resolving a non-open report or reopening a non-resolved one.

**Hotspots**

```powershell
curl.exe "http://localhost:3001/hotspots?radius_m=300&min_points=3"
```

Returns `{ hotspots, source: "ml" | "local" }`.

**Briefing**

```powershell
curl.exe http://localhost:3001/briefing
```

Deterministic rules only (`source: "rules"`): headline, summary, top categories, up to 3 hotspots, up to 5 critical open reports, recommendations.

POST `/reports` and POST `/reports/:id/action` share a limit of 30 requests per minute per IP (429 with `Retry-After`).

## When the ML service is down

- Creating a report never fails because of ML. On any error, timeout or malformed response the report is saved with category `other`, severity `low`, `ml_status: "unavailable"` and no duplicates, and a one-line warning is logged.
- `/hotspots` falls back to local grid clustering (`source: "local"`).
- `/briefing` uses whichever hotspot source is available.

The ML contract (`X-API-Key` only when `ML_API_KEY` is set, every response validated):
`POST /classify`, `POST /severity`, `POST /duplicates`, `POST /hotspots`.

## Storage

Data lives in one JSON file (`DATA_FILE`), written atomically through a serialized queue. This is fine for demos and a single process. For production, implement `ReportRepository` (`src/store/repository.ts`) on a real database and pass it to `createApp`.

## Pointing the frontend at it

In the Vite app, set `VITE_API_BASE_URL=http://localhost:3001` (for example in `.env.local`) and prefix every request with it. Send `X-Reporter-Key` on requests that create or change reports. Add the Vite dev origin to `CORS_ORIGINS` if it is not `http://localhost:5173`.