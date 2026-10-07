# Verified deployment status

Verified 7 October 2026. This is the complete initial planning release defined in the approved design, using illustrative Madurai data. It is a public preview, not a live booking operation or validated commercial business.

| Resource | Actual status | Link |
|---|---|---|
| Frontend | Vercel production READY; public | https://payanam-journeys.vercel.app |
| Planning API | Vercel production READY; public | https://payanam-planning-api.vercel.app/health |
| API documentation | Live FastAPI schema and endpoints | https://payanam-planning-api.vercel.app/docs |
| Source fork | Product branch `feat/payanam-web` | https://github.com/Krithika-2525/Payanam-2.0/tree/feat/payanam-web |
| Render | Blueprint ready; deployment pending connected account | https://dashboard.render.com/select-repo?type=blueprint |
| Supabase | Deferred at the user's request; integration design prepared | [Supabase integration](SUPABASE-INTEGRATION.md) |

Frontend deployment ID: `dpl_EM4cNAcbq4ZxPNWLQJSYRBXRUtQZ`. Deployed UI source commit: [`f735dff4673881456713a51b66be807230520de3`](https://github.com/Krithika-2525/Payanam-2.0/commit/f735dff4673881456713a51b66be807230520de3). API deployment ID: `dpl_EaSWp2EJbArc469WBdbi8WGhKZSc`. Source-file deployments use the reviewed planning modules and frontend source; they are not Git-triggered automatic deployments. Provider metadata reports iad1. Project preview deployments remain protected; the production URLs above are public.

The hosting recommendation remains **Vercel frontend + Render Python API + Supabase Auth/Postgres when supplied**. Render has no active authenticated connection in this session, so the API is temporarily on Vercel to provide a usable app now. Import `render.yaml` from this fork and select `feat/payanam-web`; set `PAYANAM_ALLOWED_ORIGINS=https://payanam-journeys.vercel.app`. Then set the frontend's `VITE_API_BASE_URL` to the new Render HTTPS origin and rebuild. Preserve the current server signing secret through secure provider settings if previously saved plans must remain eligible for replanning. Do not put that secret in frontend configuration or the repository.

## Checks actually run

- 21 planning-domain/API pytest tests passed after final review fixes.
- TypeScript/Vite production build passed.
- 9 Playwright checks passed against the local real API: create/save/reopen/delay comparison, API failure with retained form, mobile layout, invalid import, fabricated-plan import rejection, modal keyboard focus, homepage preference propagation, heritage preset filtering/selection, and Tamil navigation on narrow screens.
- Public API health, catalog and plan requests returned 200 with a feasible plan.
- Public production browser check verified the redesigned homepage, preference propagation, create/save/reload/reopen, export, delay comparison/apply/save revision, deletion/import/reopen and Tamil mobile layout at 390px. No browser runtime errors occurred. Locally hosted photograph bytes match the deployed files.
- Automated axe-core WCAG A/AA checks found no violations in home, planner, itinerary, delay dialog, delay comparison and saved views after contrast fixes. English layouts checked at 360/390/768px; Tamil navigation at 360/390/651/700/768px. See [UI refresh verification](UI-REDESIGN.md).
- Source whitespace check passed. CI workflow added for the planning service and frontend; no remote CI result is claimed yet.

The original distributed prototype's baseline is separately recorded: 53 passed, 17 skipped, 4 failed and 4 errors. Failures were the Ray entrypoint assertion and three Saga cases; four Temporal end-to-end cases errored during test-server setup. The planning release has its own entrypoint and does not load those distributed services. A clean full legacy suite is not claimed.

## Product boundaries and next business step

Save/export/import and print work without accounts; saved plans are local to the browser. Tamil navigation and place names are available; the full interface is not yet completely translated. The route sketch is not navigation. Hours, group fares and travel durations are sample assumptions; users must verify them locally. There are no real reservations, payment collection or transport dispatch.

Start with Madurai family pilgrimage/cultural operators as a **market hypothesis**. The [startup brief](startup/STARTUP-BRIEF.md) contains purpose, positioning, pricing experiments, operating costs and a 90-day validation plan. The [open-source comparison](startup/OPEN-SOURCE.md) records repository stars, license observations and integration recommendations. Before selling a live service, validate local data and operator demand, resolve upstream commercial licensing, and complete the authenticated pilot design.
