# Payanam Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a functional family journey planner with a FastAPI backend, React frontend, and Render/Vercel deployment configuration.

**Architecture:** A separate planning service uses curated Madurai data and OR-Tools without the legacy distributed runtime. A React app consumes the real API and stores saved journeys locally. Supabase authentication and database setup wait for the project ID.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, OR-Tools CP-SAT, React, TypeScript, Vite, pytest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-payanam-web-design.md`

## Global Constraints

- No live ticket purchasing until supplier contracts exist.
- Supabase connection is deferred at the user's request.
- First support a one-day Madurai circuit.
- The planning release must not need Temporal, Kafka, Ray, Memgraph, or Redis.
- Frontend API base must be provided explicitly in production.
- No credentials, fabricated bookings, or private traveler data in public source.

## Review Focus

- Imported saved-plan payloads: reject wrong structure, excessive sizes, and unsupported schema versions.
- Deadline with visit dwell/rest: finish must remain inside the selected opening session and trip deadline.
- Replanning after progress: never repeat or shift already completed visits.
- API unavailable or unconfigured: preserve user input and show a useful error, never fake success.
- Small mobile screen/keyboard: form and result actions remain reachable with clear focus and labels.

### Task 1: Deterministic planning domain and solver

**Files:** create `app/planning/catalog.py`, `models.py`, `solver.py`, `__init__.py`; test `tests/planning/test_solver.py`.
**Interfaces:** `catalog() -> dict`; `PlanRequest`; `PlanResult`; `solve_plan(request: PlanRequest) -> PlanResult`; `replan(request: ReplanRequest) -> PlanResult`.

- [x] Write tests asserting required stops are visited, completion is within opening sessions, group cost <= requested budget, optional stops can be skipped, and impossible inputs return infeasible.
- [x] Run `pytest tests/planning/test_solver.py -q` and observe missing module failures.
- [x] Implement bounded catalog and CP-SAT model with explicit arc modes, dwell and rest, budget, and finish constraints. Add replan from verified completed prefix and preserve that prefix.
- [x] Add tests for completed prefix, remaining budget, closure during dwell, and relaxed pace.
- [x] Run solver tests and inspect one generated plan manually.
- [x] Commit `feat: add family journey planning domain`.

### Task 2: Deployable planning API

**Files:** create `app/planning/main.py`, `requirements-planning.txt`, `Dockerfile.planning`, `render.yaml`; test `tests/planning/test_api.py`.
**Interfaces:** GET `/health`, GET `/api/v1/catalog`, POST `/api/v1/plans/preview`, POST `/api/v1/plans/replan`; JSON responses serialize domain types.

- [x] Test success, validation, infeasibility, allowed/disallowed CORS, oversized request, legacy endpoint absence, and solve overload.
- [x] Run API tests and observe missing endpoint failures.
- [x] Implement bounded request handling and executor-backed solving; explicit allowed origins from configuration; pinned minimal requirements.
- [x] Configure health check and Render `$PORT` startup, with no Supabase requirement.
- [x] Run all planning tests and a local HTTP smoke check.
- [x] Commit `feat: expose deployable planning API`.

### Task 3: Complete frontend journey

**Files:** create `frontend/package.json`, lockfile, Vite/TypeScript configuration, `src/App.tsx`, `src/api.ts`, `src/storage.ts`, `src/styles.css`, `src/types.ts`, `src/i18n.ts`, and component files for planner and itinerary.
**Interfaces:** API client consumes Task 2 endpoints; browser storage uses versioned, validated saved plans; user edits preferences and accepts proposed replan explicitly.

- [x] Add meaningful browser cases for successful planning, saved-plan reload, delay preview/apply, failed API with preserved form, and mobile layout.
- [x] Implement landing, planner, itinerary, saved journeys, route sketch, bilingual strings, JSON export/import and print view with sample-data disclosures.
- [x] Build with `npm run build`; run browser cases against the actual local API.
- [x] Fix accessibility and mobile issues found by inspection.
- [x] Commit `feat: build Payanam journey experience`.

### Task 4: Deployment, research, and operational handoff

**Files:** create `frontend/vercel.json`, frontend/server `.env.example` documents, `docs/DEPLOYMENT.md`, `docs/startup/OPEN-SOURCE.md`, `docs/SUPABASE-INTEGRATION.md`; update README and CI.
**Interfaces:** `VITE_API_BASE_URL` points to Render HTTPS origin; `PAYANAM_ALLOWED_ORIGINS` contains actual frontend origins; optional Supabase future settings remain unset.

- [x] Record source URLs, actual stars and license observations; document why OR-Tools remains the first solver.
- [x] Document build/start commands, configuration, data limits, recovery and Supabase owner-scoped schema design.
- [x] Run Python tests, frontend typecheck/build, browser checks, and secret/artifact scan.
- [x] Push the completed branch to the fork and deploy authorized Vercel/Render resources when connected; verify the exact commit and health before claiming live.
- [x] If Render connection or initial provider setup is missing, supply the concrete blueprint/import link, identify the blocker, and keep frontend errors honest.
- [x] Record actual URLs and deployment status in `docs/DEPLOYMENT-STATUS.md`.
