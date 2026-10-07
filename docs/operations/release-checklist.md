# Global preview acceptance — 7 October 2026

The shipped evaluation slice has real global city discovery, map/list selection, local day-by-day drafts, JSON export, optional browser translation and the preserved illustrative planner. Private PostgreSQL/PostGIS persistence, JWT verification, cloud editor, legacy import and account-data deletion are implemented and tested locally. No user-selected Supabase target or Geoapify account was supplied; hosted cloud functionality is deliberately unavailable.

Evidence: planning+travel suite uses a real limited-role Postgres 17/PostGIS 3.5 database. Browser cloud tests use locally generated RSA JWTs verified cryptographically by the real API; only identity/provider response transport is a test fixture. Production code has no test auth mode. Backup restore ownership checks passed. The 30-query source coverage CSV includes a rural no-result gap. TypeScript/Vite builds pass.

Fresh Astra review found no Critical issues, nine Important issues and one Minor. The Minor malformed-entry issue was regraded Important because it can hide saved journeys. The single fix pass covers: explicit device-capacity rejection; consented OAuth tab handoff; reconciled server-ID item ordering and normalized day positions; moves/removals before metadata shrink; account-bound mapping of already-consented local drafts; generation guards against late private responses; DB-independent city search and bounded reconnect; serialized account admission/deletion; cursor pagination; valid-record recovery from malformed local storage.

Regression evidence includes original-implementation failure when reopening and resaving a retained draft; delayed cloud response redisplaying an account after sign-out; real removal/append positions `[1,2,2]`; concurrent creation after account deletion; and city search failing on DB outage. Corrected cases run with the whole scoped suite. OAuth is tested for draft handoff/return; actual Google/email provider configuration remains deferred, not certified.

Full legacy distributed baseline remains separate: **4 failed, 4 errors, 53 passed, 17 skipped** (Temporal test-server download and existing Ray remote assertion). The aggregate directory also has duplicate `test_solver` module names under default pytest import mode; running the standalone and legacy scopes separately avoids that collection collision. Do not present the entire inherited distributed platform as passing or deployed.

Cloud release gates still open: chosen project, free-account controls, live two-account public Auth/DB test, storage admission/cleanup policy, encrypted owner backup destination, native Tamil review, commercial hosting eligibility and upstream license permission. No public sign-up/private DB pilot should be enabled until these gates are addressed. All later routing, expenses, collaboration and true externally sourced live-feed features remain separate qualification work.

## Decisions and costs

- Isolated worktree under existing build authorization: preserves the older branch; costs an additional checkout.
- Keep Payanam and original extensions rather than copy TREK: preserves the tested planner; upstream licensing still blocks a blanket open-source release.
- Real GeoNames snapshot while credentials are deferred: useful no-key global discovery; city data can be stale and does not cover all villages/venues.
- A source snapshot on each place rather than a separate multi-source facts table: smaller first-slice schema; later enrichment needs an additive migration.
- Sync SQLAlchemy through FastAPI's threadpool with a bounded pool: simpler transaction/ownership path; free-host throughput is limited.
- Conservative half-daily Geoapify admission and no automatic provider retries: reduces billing/reset risk; search can become unavailable before the provider's full free allowance.
- Browser Translator API as optional enhancement: no paid inference dependency; unsupported devices/pairs remain unavailable.
- Credential-dependent features deferred and guest preview published: avoids touching unrelated projects; hosted private saves are not ready yet.
- Shared views in TravelApp: explicit draft/journal lifecycle; later maintenance benefits from component extraction.
- Omit unqualified legacy source records from v2 exports with a note: respects unresolved export rights; legacy exports can be incomplete while original files remain unchanged.
- Malformed-entry finding regraded Important and fixed: protects recoverable drafts; stricter local validation rejects corrupted records.
- Keep original v1 secret through provider settings: preserves valid old signatures; exports from a differently keyed deployment remain unverified.
- Interrupted cloud create after browser reload is recovered into explicit version review: avoids duplication/overwriting a newer trip; traveler must export or review the current cloud copy.

No deferred code-review minor remains. The reviewer declined to certify absent cloud credentials, commercial eligibility, billing controls and licensing; these remain explicit deployment/product gates.
