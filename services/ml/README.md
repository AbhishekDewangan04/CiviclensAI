# CivicLens ML service

Phase 3 provides a lightweight, deterministic intelligence baseline. It uses
keyword scoring for category suggestions and a combined token Jaccard/cosine
similarity for duplicate candidates. It does not download models, call hosted
AI APIs, or claim measured production accuracy.

## Run

```bash
python -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Configuration is loaded from `ML_`-prefixed environment variables:
`ML_SERVICE_NAME`, `ML_ENVIRONMENT`, `ML_HOST`, and `ML_PORT`.

* `GET /health` returns `200` when the process is alive.
* `GET /ready` returns `503` with `reason: inference_unavailable`.
* Unknown routes return a stable JSON error shape.
* `POST /classify` returns a category suggestion with a heuristic score.
* `POST /duplicates` returns bounded candidate matches with similarity scores.

Run tests with `python -m pytest` from this directory using the stable Python 3.12 virtual environment.
