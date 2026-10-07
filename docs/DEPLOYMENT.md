# Deploy Payanam

## Preferred long-term split

Vercel serves `frontend/` (React/Vite). Render runs `app.planning.main:app` (Python/FastAPI). Supabase Auth/Postgres will be added after the project ID arrives. The lightweight planning service has no Temporal, Ray, Kafka, Memgraph or Redis requirement.

`render.yaml` configures the Python service, build/start command and health check. Create it with [Render Blueprint import](https://dashboard.render.com/select-repo?type=blueprint), selecting this fork and `feat/payanam-web`. Set PAYANAM_ALLOWED_ORIGINS to the actual frontend origin. The blueprint generates PAYANAM_PLAN_SECRET. Free-service cold starts can delay the first request; production reliability requires an appropriate service plan.

Frontend build: `npm ci && npm run build`, root `frontend`, output `dist`. Set VITE_API_BASE_URL to the backend HTTPS origin before building. Backend must allow that exact frontend origin; no wildcard credentialed CORS.

## Temporary Vercel API option

When Render cannot be connected, the same stateless FastAPI service can be deployed on Vercel. `deployment/vercel-api/pyproject.toml` selects the planning entrypoint; `vercel.json` requests a 30-second function and the Mumbai region. The current deployment metadata reports iad1; inspect provider settings before promising regional placement. Package only app/__init__.py and app/planning with those files and requirements-planning.txt as requirements.txt. This avoids installing the legacy distributed runtime. FastAPI lifespan events initialize the bounded executor. Set APP_ENV=production, PAYANAM_PLAN_SECRET and explicit PAYANAM_ALLOWED_ORIGINS.

The repository source remains canonical. Source-file deployments must be repeated after a code change; they do not auto-sync from GitHub. Prefer Git integrations once the provider has access. Moving to Render later only changes VITE_API_BASE_URL and rebuilds the frontend; retain the signing secret if old plans should continue to replan.

## Local run

```
python -m venv .venv
.venv/bin/pip install -r requirements-planning.txt
.venv/bin/uvicorn app.planning.main:app --host 0.0.0.0 --port 8000
```

In another terminal:

```
cd frontend
npm ci
npm run dev
```

Development defaults to http://127.0.0.1:8000; production must configure the API origin explicitly. `.env.planning.example` documents server settings; set shell environment or provider settings (the planning service does not implicitly read .env).

## Checks and operations

GET /health must report ok, illustrative-planning and the correct dataset. Check catalog, create a plan, replan, and save/reopen from the deployed frontend. Run `.venv/bin/python -m pytest tests/planning -q`; frontend `npm run build` and `npm test` (with API running). The legacy suite needs additional distributed services/test-server downloads and has separately recorded baseline failures.

No database or real reservations are involved. Signed plan contents prevent client-tampered repricing. Replan signatures change if the secret is rotated; create a fresh plan after rotation. Back up/export browser-local saved journeys before clearing site storage. Use TLS and explicit public production endpoints; keep preview deployments protected. Monitor errors, latency, cold starts and 503 overload responses before inviting operators. The two-slot solver guard is per process, not a global distributed rate limiter; add gateway quotas for wider exposure.
