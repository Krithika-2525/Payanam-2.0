# Verified hackathon itinerary release — 7 October 2026

- App: https://payanam-journeys.vercel.app
- API capabilities: https://payanam-planning-api.vercel.app/api/v2/capabilities
- API schema: https://payanam-planning-api.vercel.app/docs
- Source: https://github.com/Krithika-2525/Payanam-2.0/tree/feat/payanam-global
- Draft PR: https://github.com/Krithika-2525/Payanam-2.0/pull/2 (base `feat/payanam-web`; no merge performed).
- Deployed source commit: `8f1051b7176766b350cae7eaf879e1477a866b26`; matching local product tree: `ccc7b9d`. Remote/local tree comparison had no differences before deployment.
- API: `dpl_6vHmK5xRbmeS3jQQExFe6qNijaSf`; frontend: `dpl_DeQVgwyNwcntwB8TypxwqrdXG7tY`. Both READY on existing projects, canonical public aliases verified, reported region `iad1`. The existing signing secret was preserved. Source-file deployments remain manual.

## Working public journey

Search a city → explore real nearby hotspots → choose dates, interests, pace and walking/driving → generate timed multi-day visits → inspect day tabs and mapped stops → edit/recalculate → record personal expenses and packing → save/reopen on device → export JSON/calendar or print a guide. Weather failures and deferred private-cloud configuration do not block this guest journey. Routes/distances/times are clearly labelled geometric estimates; source opening hours require confirmation.

Production API checks passed for Madurai (35 OSM hotspots, 6/6 packed walking visits across two days), Paris (100 OSM, 6/4 visits) and Tokyo (7 Wikipedia, 5/2 visits). Return times stayed within 18:00. Actual production CORS admits the canonical app origin. Capabilities report `hotspot_discovery=true`, `itinerary_generation=true`, `weather_forecast=true`, `road_routes=false`, `cloud_trips=false`; 34,154 sourced cities.

Production Chromium exercised Madurai city selection, 35 sourced cards, itinerary generation, ₹3,000 personal budget/₹450 expense, packing checkbox, device save/reload/reopen and calendar download. A subsequent Paris check verified real map tiles/markers/estimated overlay, mobile 360px layout without horizontal overflow, stop removal marking calendar stale and successful recalculation restoring export; no page errors. One manual verification script used an incorrect tab selector after completing the Madurai export; the corrected Paris journey passed. No product defect was found in that selector failure.

## Verification

Fresh local scoped checks: **87 backend tests, 25 browser tests, successful TypeScript/Vite production build**. Backend tests use real limited-role PostgreSQL 17/PostGIS 3.5; browser private-save checks use cryptographically verified RSA JWT fixtures and the real database. Source-provider transport fixtures cover failures; bundled venues are actual retrieved records, not invented demo attractions. Fresh Astra review found four Important issues; one failing-then-passing regression fix pass covered edit protection, safe import validation, lunch including transit/return, and retained source recalculation. Relaxed pace/repeat-day findings were also fixed. Minor return-summary persistence and cache-only retention limits are documented in `release-checklist.md`.

Deployed source passed both GitHub CI runs:
- https://github.com/Krithika-2525/Payanam-2.0/actions/runs/37609791343
- https://github.com/Krithika-2525/Payanam-2.0/actions/runs/37609783943

The unchanged inherited distributed platform is separate: **4 failed, 4 errors, 53 passed, 17 skipped**, recorded in the release checklist. This is not a claim that all inherited distributed services are deployed or green.

## Costs and deferred integrations

No new paid resource, card, hosted inference, billable key or Supabase database was created. Maps, discovery, optimization and forecasts use the chosen no-key path. The dated corpus has **678 records across 12 destinations**, with explicit source links, licenses and retrieval times. Public providers/free-host quotas can limit availability; there is no real-time SLA or automatic polling.

User-selected Supabase DB/Auth remains deferred; tested migrations, private API and browser integration are ready. Render Free blueprint is prepared; the connected account is expired, so no Render service was provisioned. The existing Vercel frontend/Python API provide the working noncommercial hackathon without that dependency. Translation remains browser/language dependent; universal coverage, live traffic, bookings and fares are not claimed. Upstream lacks a LICENSE, so this is a source-available fork without a blanket open-source license grant.
