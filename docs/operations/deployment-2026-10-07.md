# Published guest preview — 7 October 2026

- Frontend: https://payanam-journeys.vercel.app
- API: https://payanam-planning-api.vercel.app/api/v2/capabilities
- Reviewed source: https://github.com/Krithika-2525/Payanam-2.0/tree/feat/payanam-global
- Draft PR: https://github.com/Krithika-2525/Payanam-2.0/pull/2 (base `feat/payanam-web`; no merge performed)
- Source artifact commit: `52f57263688c96e4ac91764fa969c043961d97d4`; local reviewed implementation `222f75d` has matching product source.
- API deployment: `dpl_42aWwHZhBSpNB4xfSSRKpimchsUL`; frontend: `dpl_NUHAXhpbjEykeyFAMPk6ovb6APZK`. Both READY on existing Vercel projects; reported deployment region `iad1`.

Public browser evidence: actual India/Madurai and France/Paris results, sourced cards, destination addition, explicit device save, reload/reopen, desktop/mobile layout, no horizontal mobile overflow and no page exceptions. API cross-origin responses permit the canonical frontend. Capabilities report 34,154 cities, `cloud_trips=false`, `place_search=false`; these are intentional while user credentials are deferred.

Additional public checks passed: clicking the actual Madurai map marker, JSON export with GeoNames attribution, Tamil preview layout at 360 px, deferred sign-in dialog and keyboard Escape/focus return. GitHub CI initially caught a test-origin mismatch: the legacy CORS test requires port 5173 while the new browser workspace uses 5180. Both explicit test origins are now admitted in CI; production still admits only configured public origins.

Scoped local verification: **63 backend tests, 19 browser tests, successful TypeScript/Vite build**. Real local PostgreSQL/PostGIS ownership, concurrent edits/deletion, response-loss retries, reopened draft association, reorder/date shrink, 51-trip pagination, late account response, OAuth tab handoff and legacy export rights were exercised. The preserved distributed legacy baseline failures are documented separately.

The compressed city artifact was SHA-256 verified before publishing: `27a02ecfb445491b39ab40bacb4aecc424833711bf56d0ead138f5f188cd2b2e`. An integration payload limit required transferring that artifact in chunks and committing it after the text source; the final branch includes the exact tested binary. Vercel builds include the same artifact; no runtime download or fabricated data fallback.

No Supabase cloud DB, Auth provider, Geoapify account, Render service, paid upgrade or billed fallback was created. The Render Free blueprint and limited-role Supabase migrations are ready for the owner's later configuration. Existing Vercel preview is personal/noncommercial; it is not a certified commercial free-host profile. Review `zero-bill-deployment.md`, `privacy-and-retention.md` and `release-checklist.md` before connecting cloud data or inviting a public pilot.
