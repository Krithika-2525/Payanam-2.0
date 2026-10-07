# ₹0 launch profile

This release is a personal evaluation preview, not a commercial startup launch. No paid resource, card, upgrade, paid API fallback or new cloud database was created.

| Component | Implemented | Remaining connection |
|---|---|---|
| Frontend | React/Vite; existing Vercel project | Commercial use needs an eligible host or plan |
| API | FastAPI; Vercel-compatible package; Render Free blueprint | Render account connection deferred |
| Map | MapLibre, OpenFreeMap Liberty, visible attribution | No key needed; availability is external |
| City discovery | 34,154 licensed GeoNames cities | Snapshot; explicit manual refresh script |
| Private DB | Tested PostgreSQL/PostGIS migrations and forced RLS | User-selected Supabase project ID deferred |
| Authentication | Supabase browser SDK and asymmetric JWT verifier | Project URL/public key and provider setup deferred |
| Nearby hotspots | Keyless OSM/Overpass with qualified Wikipedia fallback; 12 dated snapshots | Public service availability/coverage varies |
| Itinerary | In-process OR-Tools, geometric travel estimates | No API key or LLM required |
| Weather | Cached dated Open-Meteo forecasts | Free noncommercial forecast horizon only |
| Optional detailed place search | Server-only Geoapify adapter, durable cache/quota gates | Free key and no-overage qualification deferred |
| Translation | Browser-local Translator API | Browser/language dependent; no universal coverage claim |

Vercel Hobby is for personal/noncommercial use: https://vercel.com/docs/plans/hobby . An actual commercial frontend should use a currently eligible free host such as Cloudflare Pages after account/terms verification: https://developers.cloudflare.com/pages/platform/limits/ . Do not upgrade to Pro to satisfy this brief.

Render Free web services sleep after 15 minutes of inactivity; storage is ephemeral and monthly free compute/bandwidth limits apply: https://render.com/docs/free . Do not use Render Free Postgres: its database expires after 30 days and lacks backups. Supabase Free currently provides a small database/free quotas and can pause after a week of inactivity, without included automatic backups: https://supabase.com/pricing and https://supabase.com/docs/guides/platform/backups . Recheck terms, storage/egress, connection limits, region and free controls when the owner supplies the project; these are not lifetime guarantees.

For the supplied Supabase target, review and apply `alembic upgrade head` using `PAYANAM_MIGRATION_DATABASE_URL`; create a **separate limited runtime login** granted `payanam_app`, and use that login's pooled connection in `DATABASE_URL`. Never use the migration/superuser connection as runtime. The schema is private `travel`, not exposed browser tables. Configure asymmetric signing keys, email/Google providers and exact frontend redirect allowlist. Set only a publishable/anon key for the browser; secret/service-role keys are rejected. Production secrets go in provider settings.

Geoapify search requires all three: database, server key, `GEOAPIFY_ZERO_BILLING_CONFIRMED=true`. Each call reserves one durable credit before execution, never retries automatically, and caps each UTC date at 1,200 credits by default to conservatively cover a provider's unknown 24-hour reset window. This application gate does not replace account-level zero-overage controls. Snapshot city discovery remains useful without that provider.

Frontend builds require an explicit `VITE_API_BASE_URL`; the API requires exact `PAYANAM_ALLOWED_ORIGINS` and production `PAYANAM_PLAN_SECRET` (retain the existing secret for v1 signature continuity). Cloud features stay visibly deferred without configuration. Keep the compatible old deployment available for rollback; the illustrative planner is reachable with `?mode=demo`.
