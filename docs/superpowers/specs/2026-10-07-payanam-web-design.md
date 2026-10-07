# Payanam web product and deployment design

Proposed delivery: complete planning application; no live ticket purchasing until supplier contracts exist. Supabase connection is deferred at the user's request.

## Purpose

Help a family organizer and their travel operator preserve meaningful visits while staying within time, money, and comfort limits. Promise: “Travel with confidence. Keep the moments that matter.” Product decisions emphasize realistic pace, clear costs, rest, respectful local context, and understandable alternatives. Narrative appears in onboarding, itinerary explanations, and disruption messages; factual claims come from data, not generative guesses.

## Best approach

Use the existing Python ecosystem for constraint solving. Build a React + TypeScript frontend with Vite on Vercel and a lightweight FastAPI API on Render. Keep the existing distributed workflow implementation available for future operational integration, separate from the planning service. The planning release must not need Temporal, Kafka, Ray, Memgraph, or Redis. Supabase will later provide Auth and Postgres persistence; no project creation or database mutation happens yet.

First support a one-day Madurai circuit with curated local places, coordinates, illustrative opening sessions, travel estimates, dwell times, and explicit sample-data labeling. Start from a supported hub. No claim of statewide production coverage. All hours must be locally verified before live use; examples are not operating guarantees. Multi-day trips and other regions are later work.

## Experience

Responsive branded application with home, planner, itinerary details, and saved journeys. Warm ivory, deep green, terracotta, accessible typography, a simple geographic route sketch, and a clear sense of place. Family priorities: required visits, date, starting time, finishing time, budget, party size, and relaxed/standard pace. Show a suggested itinerary, estimated group transport spend, dwell/rest intervals, opening sessions, and reasons for skipped optional stops.

Saved journeys persist in this browser with explicit wording. Export a structured JSON backup, import validated backups, and print a traveler itinerary. No pretend cloud accounts or cross-device synchronization. Tamil and English interface strings use a vetted small dictionary; mark cultural/site notes as informational examples.

A simulated delay changes only pending legs. Show before/after time and cost, keep completed visits fixed, and ask the traveler to apply the revised plan. Declining leaves the prior plan intact. The revised itinerary remains an estimate, with no bookings or payment side effects. Infeasibility offers specific adjustments rather than a fabricated route.

## Backend

New isolated package `app/planning` and entrypoint `app.planning.main:app`. API:
- GET `/health`: planning status and dataset version.
- GET `/api/v1/catalog`: supported hub, places, dataset caveat, pace choices.
- POST `/api/v1/plans/preview`: validated preferences to structured itinerary.
- POST `/api/v1/plans/replan`: prior preferences, completed place IDs, delay minutes, and current start point; server validates/reconstructs facts rather than trusting submitted costs or times.

CP-SAT models selected arcs, arrival, visit duration, departure, required visits, optional visits, disjoint sessions, max-stop bounds, party cost budget, and finish deadline. Unique arcs represent transport choices explicitly. Use integer minutes and integer rupees/paise for constraints. Return exact selected route and aggregate estimates. Starting point is a depot, with no required return unless the interface explicitly requests it. Limit candidate set to the supported catalog.

Run bounded solving outside the async event loop, with a configured solve timeout and small fixed worker count. Reject excessive concurrent solves and oversized bodies. Set explicit allowed origins, reject unsupported IDs and invalid date/time combinations, sanitize errors, and expose no legacy driver dispatch or simulated booking endpoints through this service.

## Deployment and Supabase preparation

Commit `render.yaml`, pinned planning requirements, production Dockerfile, frontend lockfile, Vercel configuration, environment examples, and deployment documentation. Serve API on `$PORT`, support health checks, handle SIGTERM, and allow the deployed frontend origin through configured CORS. Frontend API base must be provided explicitly in production; never silently use localhost or fabricate an API response if offline.

Supabase preparation consists of a documented owner-scoped table design and integration boundary; no credentials needed in this release. When project ID arrives, introduce authenticated saved journeys and row ownership policies with both USING and WITH CHECK. Keep secret/service-role keys off the browser. Migration and live verification are deferred together.

## Open-source choice

GitHub snapshot 7 October 2026: OpenTripPlanner 2,750 stars; MOTIS 601; Valhalla 6,290; VROOM 1,880; MapLibre GL JS 11,813. Stars are popularity signals, not suitability guarantees. MOTIS/OpenTripPlanner are future transit candidates when approved timetable feeds exist. Valhalla could supply road travel matrices. VROOM targets fleet routing and is not a drop-in pilgrimage planner. Keep OR-Tools for dwell, opening sessions, and family priorities. Avoid adding a second routing service before validated data exists. A geographic sketch needs no external map or geocoding service; MapLibre can be added when map tiles and licenses are selected.

## Acceptance

Planning works end to end against the actual API. Invalid and infeasible input, closing sessions, time budget, party cost budget, optional stops, rest intervals, and completed-stop replanning have meaningful automated coverage. Test API request limits, concurrency, and CORS behavior. Frontend builds with TypeScript checks and exercises form, planner, saved journeys, disruption preview, offline failure, and mobile viewport. Publish only reviewed source and pinned artifacts. Report actual live links only after successful deployment and smoke tests; connection/setup links are identified separately.
