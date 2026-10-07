# Payanam Global Product — Draft Roadmap and First-Slice Implementation Plan

> **For agentic workers:** This is an unapproved planning artifact, not an execution instruction. After the user reviews and approves the first-slice spec and plan and chooses an execution method, use `superpowers:executing-plans` or the explicitly selected `superpowers:subagent-driven-development` method, task by task. Checkboxes intentionally remain unchecked.

**Goal:** Deliver real global place discovery, an accessible map, authentication and private cloud trips within the user's strict ₹0 recurring infrastructure requirement; qualify later planning, translation, collaboration and fresh-data capabilities as separate releases.

**Architecture:** Retain React/Vite and FastAPI, add a v2 domain and portable Postgres/PostGIS with a managed free Auth/DB target when authorized, and integrate MapLibre with permitted free tiles/search providers. Preserve the signed v1 planner. Use quota enforcement and graceful degradation; do not create a billed service or promise always-on behavior.

**Tech Stack:** Existing Python/FastAPI/Pydantic/OR-Tools; React/TypeScript/Vite; proposed MapLibre GL JS, Postgres/PostGIS, SQLAlchemy/Alembic, an OIDC/JWT verifier and provider-supported auth client; pytest and Playwright. Pin compatible versions at execution time. Translation models, routing engines, SSE workers and billing are outside the first slice.

**Spec:** [Astra product draft](../specs/2026-10-07-payanam-global-draft.md). **Evidence:** [official provider, competitor and ₹0 research](../../startup/REAL-DATA-RESEARCH-2026-10-07.md), reviewed 7 October 2026. Read both documents before execution. The master spec covers a product direction; only Workstream B is decomposed into implementation tasks here. Later streams need their own reviewed specs and plans.

## Global constraints

- Strictly ₹0 recurring infrastructure charges at launch. No automatic billed upgrades, paid API fallback, or paid background-worker dependency.
- Global search, supported routing, verified venue hours, and live transport are separate coverage claims.
- `/api/v1`, `PlanResult.schema_version = 1`, `payanam.saved.v1`, and existing signed exports retain their validation and behavior during migration.
- New cloud trips use `TripDocument.schema_version = 2`; browser v1 saves are never silently uploaded or overwritten.
- No real reservations, payment collection, transport dispatch, invented place facts, or simulated data returned as a real provider result.
- Public Nominatim is not the typeahead adapter; public OSM tiles are not an offline-download source.
- Anonymous users may browse places; private trips require verified identity and owner authorization in API and database.
- No service-role credentials, database passwords, signing secrets, or private traveler data in frontend bundles, logs or public source.
- Global optimization, live traffic, universal translation, collaboration, billing, and always-on source ingestion are outside B.
- Every production data field must have an allowed source or a clear user-entered/estimated/unknown status; test fixtures are allowed only in tests.
- No declaration that the whole fork is open source until upstream rights are resolved.

## Review focus

These five high-risk conditions have explicit owning tasks below:

1. A Tamil/Hindi query or same-name place in another country must preserve script and return the correct distinct source identity (Tasks 2, 6, 10).
2. Reused pooled DB connections, forged owner IDs and expired JWTs must never expose another user's trip (Tasks 3–5, 10).
3. A provider quota/outage, sleeping API or broken map must preserve user work and never substitute demo records (Tasks 2, 6, 7, 11).
4. A legacy signed export or duplicate retry must preserve the original save and avoid silently duplicating or trusting imported facts (Tasks 5, 8).
5. Conflicting edits, ambiguous timezone, and day/item mismatch must produce visible validation/conflict rather than corrupting a trip (Tasks 4, 5, 7).

## Shipping sequence and decision gates

| Milestone | Deliverable | Exit evidence | Next decision |
|---|---|---|---|
| M0: rights/provider qualification | Legal/coverage register; chosen free hosting profile | Published terms, quotas and fixture provenance; upstream license status | Approve B implementation and targets |
| M1: anonymous discovery | Real search + map/list with source disclosure | Live low-volume India/non-India probes; empty/error/mobile flows | Does provider quality justify persistence work? |
| M2: private cloud trips | Auth, DB ownership, trips, export, v1 import | Two-account attack tests; actual cross-session browser journey | Invite limited pilot within quotas |
| M3: regional planning | Qualified road matrices/hours and family constraints | Region-specific C acceptance; real trip review | Expand regions only with evidence |
| M4: multilingual tools | Reviewed UI; supported-pair translator/phrase packs | Native-language benchmark; measured free execution feasibility | Add language pairs independently |
| M5: collaboration/budget | Roles, revocable sharing, expense ledger | Permission matrix and monetary invariant tests | Operator pilot readiness |
| M6: fresh data | Durable on-demand updates first; background feed processing only on qualified free resources | Real source update and client replay evidence; no idle-worker promise | Fund or self-host later SLA needs |
| M7: business experiment | Validated pricing and support offer | Rights, unit economics, platform commercial eligibility | No paid launch on ineligible free hosting |

Dates are intentionally not promised before provider/account decisions and pilot capacity are known. Suggested effort bands, not delivery quotes: B ~3–5 engineer-weeks including identity, data rights and verification; C ~2–4 weeks per initial routing region; D ~1–3 weeks plus native reviewers; E ~2–3 weeks; F ~2–4 weeks after feed access. One-person part-time delivery and licensing/account setup can take longer. Sequence against acceptance, not the calendar.

## B file map

Keep changes localized; the current compact legacy modules are not the place for new global behavior.

| Files | Responsibility |
|---|---|
| `app/travel/models.py`, `errors.py`, `config.py` | Strict v2 contracts, typed failures, free-mode configuration |
| `app/travel/providers/base.py`, `geoapify.py`, `cache.py`, `registry.py` | Place provider contract, chosen adapter, rights-aware cache and quotas |
| `app/travel/auth.py` | Verified issuer/subject, actor mapping, JWT/JWKS validation |
| `app/travel/db.py`, `tables.py`, `repository.py` | Limited-role connections, relational schema, transaction and ownership logic |
| `app/travel/service.py`, `api.py` | Trip changes, source resolution, API endpoints and errors |
| `app/travel/legacy.py` | Opt-in v1 import; no change to legacy signature semantics |
| `migrations/env.py`, `migrations/versions/0001_travel_private.py`, `alembic.ini` | Reproducible B schema and RLS; version name generated consistently at implementation |
| `app/planning/main.py` | Mount v2 router, lifespan resources and explicit auth/CORS methods; retain v1 behavior |
| `frontend/src/travel/contracts.ts`, `client.ts`, `auth.ts` | Generated v2 types, authenticated HTTP, provider auth integration |
| `frontend/src/travel/Discover.tsx`, `PlaceResults.tsx`, `PlaceCard.tsx`, `TravelMap.tsx` | Accessible discovery and map/list selection |
| `frontend/src/travel/TripEditor.tsx`, `TripList.tsx`, `TripDay.tsx`, `useTripDraft.ts` | Private trips, day/items, unsaved drafts and conflict recovery |
| `frontend/src/travel/Evidence.tsx`, `Status.tsx` | Source/freshness and unavailable states |
| `frontend/src/travel/legacyImport.ts`, `export.ts` | v2 export/import UX with bounded validated data |
| `frontend/src/locales/en.json`, `ta.json` | Complete first-slice reviewed strings; locale infrastructure |
| `frontend/src/App.tsx`, `styles.css`, `api.ts` | Route new workspace, reuse branding; retain legacy mode |
| `tests/travel/` | Provider contracts, JWT, DB/RLS, API, compatibility and budget tests |
| `frontend/tests/travel.spec.ts` | New end-to-end journeys and mobile/accessibility cases |
| `docs/providers/`, `docs/operations/` | Provider register, coverage results, zero-bill deployment/restore runbooks |

The listed paths are proposed product changes, not files created in this draft. Use one migration system for portable schema; do not maintain diverging Supabase and Alembic versions of the same tables. If a Supabase-specific auth mapping migration is required, document and test it as an adapter extension.

## Task 1: qualify rights, zero-bill providers and v2 contracts

**Files:** Create `docs/providers/register.json`, `coverage.csv`, `README.md`; create `app/travel/models.py`, `errors.py`, `config.py`; tests `tests/travel/test_models.py`. Modify dependency manifests only after approval.

**Interfaces:** Produce `PlaceQuery`, `ProviderPlaceRef`, `ResolvedPlace`, `PlaceSearchResult`, `Evidence`, `Actor`, `TripCreate`, `TripChange`, `TripDocument`, `ProviderCapabilities` and `TravelError`. `TripChange` is a discriminated union: `update_metadata`, `add_item`, `move_item`, `update_item`, `remove_item`; batch changes are not part of B. `add_item` references an existing server-resolved `place_id`; user notes are plain text.

- [ ] Run a bounded read-only TREK comparison: map current day-board/budget/offline features, AGPL obligations, India-language gaps, solver integration boundary and free deployment feasibility. Recommend extend versus adopt before rebuilding commodity features; unresolved upstream Payanam rights can change the decision. Record exact tile/search service terms, quotas, allowed cache/storage/export, commercial eligibility, attribution and source-access date. Test 30 low-volume real place cases; report missing fields and ambiguous matches. Geoapify permits caching/storing with attribution, but verify planned export/ODbL use and account-level zero billing: terms allow suspension or overages. No-card status plus internal rate limits alone is not a contractual guarantee. If enforceable zero billing is unresolved, disable the provider and choose a rights-qualified zero-charge alternative through a reviewed revision.
- [ ] Write schema tests: `test_native_script_query_preserved`, `test_coordinates_reject_nonfinite`, `test_trip_date_and_day_limits`, `test_metadata_ignores_no_forged_owner`, `test_only_known_change_kinds`. Assert query length 2–200, result limit <=10, title length 1–120, trip length 1–30 days, items <=200, explicit valid timezone, valid ISO currency; unknown fields rejected.
- [ ] Run `pytest tests/travel/test_models.py -q`; observe contract failures before implementation.
- [ ] Implement models and `PAYANAM_BILLING_MODE=free_only` configuration. Require explicit provider capabilities; never silently enable a paid fallback. Store source times as nullable aware timestamps, not invented current timestamps. Make provider credit ceilings and cache rights explicit.
- [ ] Re-run schema tests and inspect generated JSON/OpenAPI shape. Commit only this bounded deliverable and qualification records. If terms fail, stop dependent provider persistence work with the concrete missing right documented.

## Task 2: real place adapter with durable quotas and evidence

**Files:** Create `app/travel/providers/{base,geoapify,cache,registry}.py`; tests `tests/travel/test_places.py`, `fixtures/geoapify/` with source-permitted, sanitized contract fixtures.

**Interfaces:** Consume Task 1 models. Produce `PlaceProvider.search(query: PlaceQuery) -> PlaceSearchResult`, `resolve(reference: ProviderPlaceRef) -> ResolvedPlace`, `capabilities() -> ProviderCapabilities`. Produce `PlaceService.search(query, actor_bucket)`. Provider I/O is async and time-bounded; cache and quota interfaces support the DB implementation in Task 4. Use a local in-memory implementation only for isolated unit tests, never as cross-instance production quota enforcement.

- [ ] Write tests for Tamil/Latin queries, exact country distinctions, OSM node/way ID collisions, missing hours/timezone, denied source fields, malformed coordinates, 429 and retry headers, timeouts, stale permitted cache, and quota exhaustion. Assert every returned fact has `provider`, `retrieved_at`, nullable `observed_at`, rights reference and attribution; a provider outage returns no `catalog.PLACES` data.
- [ ] Run `pytest tests/travel/test_places.py -q` and observe adapter failures.
- [ ] Implement the qualified Geoapify search adapter with server-side key, explicit submitted query (no B autocomplete), max ten results, 5-second timeout and at most one eligible transient retry. Preserve provider IDs and original names; omit missing facts. Use provider-global daily/minute credit limits as well as client limits, initially cap all controlled account use at 2,400 of 3,000 observed credits/day, and reserve credits transactionally before network calls; retries count. Use Geoapify’s endpoint-specific formula, not HTTP-request counts. Other uncontrolled account/key consumers are forbidden for this profile. Daily quota is UTC-based only if consistent with provider accounting; otherwise use the provider's documented reset window.
- [ ] Test HTTP 429/503 classification, deduplicated concurrent search, request parameter sanitation, and `Cache-Control` handling. No provider load testing. Verify a single live India and non-India query manually within policy and record observation time/result identity.
- [ ] Run provider tests and commit. A key/config error makes the capability disabled with a useful message, not a mocked success.

## Task 3: identity integration before private APIs

**Files:** Create `app/travel/auth.py`, `frontend/src/travel/auth.ts`; tests `tests/travel/test_auth.py`. Configure the chosen OIDC/Supabase provider only in an approved target.

**Interfaces:** `IdentityVerifier.verify(token: str) -> VerifiedIdentity`; `resolve_actor(identity: VerifiedIdentity) -> Actor`. `VerifiedIdentity` contains trusted issuer and subject; roles are not read from editable profile metadata. Frontend auth adapter exposes `signIn()`, `signOut()`, `getAccessToken()` and session-change subscription.

- [ ] Write tests for valid/expired/wrong-audience/wrong-issuer JWT, forbidden `alg=none`, unknown key ID/JWKS rollover, tampered claims, deactivated user, and a user-editable role/owner claim. Assert invalid tokens produce 401 and never map to an actor.
- [ ] Run `pytest tests/travel/test_auth.py -q` and observe failures.
- [ ] Implement pinned issuer/audience and supported algorithm validation via a maintained JWT library. Map `(issuer, subject)` uniquely to internal user UUID; check deactivation for private requests. Use OAuth/PKCE with the provider library; make redirect URLs explicit for localhost/staging/production. Prefer an eligible free social OAuth flow for the ₹0 pilot; do not assume production email delivery is unlimited/free.
- [ ] Test sign-in redirect retains a plain-text local draft without auto-upload, sign-out clears account-scoped caches, and token/log/URL leakage is absent. Test a legitimate key rollover and bounded JWKS failure handling.
- [ ] Run auth tests and commit. Project ID/issuer/credentials are setup dependencies; local tests use test issuer keys, clearly separate from deployment.

## Task 4: portable DB, owner RLS and trip transactions

**Files:** Create `app/travel/{db,tables,repository}.py`, Alembic files and initial migration; tests `tests/travel/test_repository.py`, `test_rls.py`, `conftest.py`.

**Interfaces:** Produce `TripRepository.create(actor, data, idempotency_key) -> TripDocument`, `get(actor, trip_id)`, `list(actor, cursor, limit)`, `revise(actor, trip_id, expected_version, change, idempotency_key)`, `delete(actor, trip_id, expected_version)`; implement durable cache/quota storage for Task 2. Migration role is separate from runtime role.

- [ ] Against a disposable local Postgres/PostGIS test database, write direct-SQL tests for user A/B SELECT/INSERT/UPDATE/DELETE, parent-child access, forged owner/day mismatch, connection reuse, missing actor context, unauthorized raw table access and idempotency-key collision. Assert A cannot read B's row and cannot insert a child into B's trip. Use actual DB roles and RLS, not mocked authorization.
- [ ] Run `pytest tests/travel/test_repository.py tests/travel/test_rls.py -q`; observe missing-schema or permission test failures.
- [ ] Implement B tables from the spec, all ownership/foreign-key checks and needed indexes; geography GiST and owner/date cursor indexes. Use an async connection pool bounded to free DB connection limits and transaction-scoped actor settings. Enable/force RLS for private tables and use `USING` plus `WITH CHECK`. Ensure migration owner/superuser is never the app connection. Add a unique trip/revision constraint and atomic version increment/outbox insert. An actor ID cannot be taken from an HTTP body.
- [ ] Test two requests editing the same version: exactly one succeeds, one receives conflict; retry same key/body returns the original result, while changed body is 409. Test interrupted transaction leaves no partial trip, revision or outbox row. Trip deletion physically removes owned content and dependent snapshots/revisions in one transaction, without depending on a sleeping service's timer; test both successful cascade and rollback on failure. Exercise quota reservations across two independent connections. Inspect query plans for owner-list and spatial lookup using representative test data.
- [ ] Apply migrations to an empty and previous-schema local DB, run all DB tests, rehearse a logical export/restore and verify row counts/ownership, then commit. This task does not apply migrations to an unknown hosted project.

## Task 5: complete v2 private-trip API

**Files:** Create `app/travel/{service,api}.py`; modify `app/planning/main.py`; tests `tests/travel/test_api.py`, `test_compatibility.py`.

**Interfaces:** Expose all B routes in the spec. `If-Match` carries integer revision (ETag serialization documented); errors use `{code, message, request_id, retryable}`. Public and private response schemas are separate; actor derives from Task 3.

- [ ] Write endpoint tests for search/details, create/list/read/change/delete/export, validation, unsupported capability, and unauthenticated/non-owner access. Assert unknown/non-owned trip 404 responses are indistinguishable; no existence leaks via export or idempotency responses. Assert private responses use `Cache-Control: no-store`.
- [ ] Run `pytest tests/travel/test_api.py tests/travel/test_compatibility.py -q` and observe missing route failures.
- [ ] Implement routes, service operations and safe error mapping. PATCH validates all changes server-side, resolves place source snapshots via Task 2 and atomically invokes Task 4. B starts with owner-only trips. Preserve the 64KB inbound-body boundary; compact normal B documents to fit supported edit payloads, use single-item edits, and cap legacy import separately at 64KB. Exports may be larger and have a documented browser validation limit before future reimport support.
- [ ] Update CORS for explicit origins and required `Authorization`, `Idempotency-Key`, `If-Match`, GET/POST/PATCH/DELETE methods. Expose ETag/Retry-After as necessary; no wildcard credentials. Add `/api/v2/capabilities` with no keys, and readiness that distinguishes DB/provider-disabled from liveness. Keep v1 health/behavior backward compatible rather than overwriting it with a global-readiness claim.
- [ ] Run `pytest tests/planning tests/travel -q`; assert the existing 21 planning cases remain passing alongside v2 tests. Commit after OpenAPI review and secret/error trace checks.

## Task 6: real discovery map/list experience

**Files:** Create `frontend/src/travel/{contracts,client}.ts`, `Discover.tsx`, `PlaceResults.tsx`, `PlaceCard.tsx`, `TravelMap.tsx`, `Evidence.tsx`, `Status.tsx`; modify `frontend/src/App.tsx`, styles and package/lockfile; tests `frontend/tests/travel.spec.ts`.

**Interfaces:** Consume generated v2 OpenAPI types and `GET /places/search`. Shared selected `place_id` drives map and list. Map style URL is configuration, defaulting to qualified OpenFreeMap; required OpenMapTiles/OSM attribution remains visible. No map provider secret in source.

- [ ] Add browser tests: submitted native-script query returns actual test-provider contract result, country disambiguation, selecting marker selects card and vice versa, no-result vs provider-failed states, and a disabled WebGL/blocked tile request leaves the list usable. Test wrong API origin/config has visible error, no localhost fallback in production.
- [ ] Run `npm --prefix frontend test -- travel.spec.ts` against the local real v2 API with the explicit test-provider fixture profile; observe missing UI failures. Keep live-service smoke separate from deterministic tests.
- [ ] Implement accessible search, map/list, source drawer and add-to-draft action. The browser has a separate bounded 90-second cold-start allowance with visible wake/retry state; server-to-provider calls retain the 5-second timeout. Check content type and safely handle HTML host wake/error responses before JSON parsing. Debounce is unnecessary for submit-only search; abort obsolete requests, ignore stale responses and preserve query/draft on timeout. Lazy-load MapLibre and mount it only when visible. Keep map styles and data providers replaceable.
- [ ] Test 360px mobile, keyboard-only search/result/add sequence, reduced motion, long Tamil names, missing coordinates and provider attribution visibility. Mark approximate result centroids if supplied as such. No decorative simulated GPS or live traffic overlay.
- [ ] Run TypeScript/build and focused browser tests, inspect desktop/mobile screenshots, then commit.

## Task 7: authenticated trip workspace and cross-device persistence

**Files:** Create `frontend/src/travel/{TripEditor,TripList,TripDay}.tsx`, `useTripDraft.ts`; extend `client.ts`, auth UI and tests.

**Interfaces:** Consume Task 5 trip routes and Task 3 auth state. In-memory/local drafts have their own `payanam.drafts.v2` key and schema; persistent trip identity comes from server. No mixing with `payanam.saved.v1`. Frontend sends expected version and a stable key for retry of each user action.

- [ ] Write browser tests for search/add-three-places/create-trip/sign-in/save/reload/reopen, separate browser context same account, sign-out then other-account isolation, and create retry after a network drop. Assert one server trip exists after an ambiguous retry and the pre-sign-in draft requires explicit save.
- [ ] Run focused browser tests; observe missing workspace behavior.
- [ ] Implement metadata/day/item edits, keyboard move controls, save status, unsaved-change warning, delete confirmation and explicit conflict review. Show “Saved” only after DB acknowledgement. On conflict, preserve local edit, fetch newer version and let the user reapply/cancel; never silent last-write-wins. B day lists are unscheduled and must not display fabricated travel duration.
- [ ] Add tests for 30-day/200-item limits, a day outside the trip range, a date-range shrink containing items (reject until moved), invalid timezone and currency, offline reload of consented draft, expired token during save, and sleeping API retry with a non-JSON host response. Server remains authority for limits even if client validates them.
- [ ] Run build/browser checks and two-account API suite; commit once cross-session persistence and account-cache clearing pass.

## Task 8: portable export and careful v1 migration

**Files:** Create `app/travel/legacy.py`, `frontend/src/travel/{legacyImport,export}.ts`; tests `tests/travel/test_legacy.py` plus browser migration tests. Preserve existing `frontend/src/storage.ts` validators.

**Interfaces:** `import_legacy(actor: Actor, original: LegacyEnvelope, idempotency_key: str) -> TripDocument`; source hash deduplicates retries. v2 export envelope has `{kind: 'payanam-trip', version: 2, trip, attributions}`. v1 HMAC trust remains solely with v1 verification rules.

- [ ] Write tests for valid v1 export, wrong signature, missing signature, excessive length, HTML in notes, unsupported version, duplicate import, unsupported source export rights and non-owner export. Assert original local payload/signature bytes remain unchanged and resulting v2 facts say illustrative/legacy rather than verified.
- [ ] Run `pytest tests/travel/test_legacy.py -q` and observe missing migration behavior.
- [ ] Implement opt-in migration and export permissions. Retain original plan only in a bounded private legacy envelope. Unknown/invalid signature allows no trusted replan; structurally valid user import may be viewed with legacy/unverified label according to the spec. Do not mint a new v1 signature for imported content. Remove any fields not licensed for export with an explicit export note, or block a provider from storage at qualification rather than discovering incompatible rights at export time.
- [ ] Test migration sign-in/cancel/retry and export download in browser. Check exported JSON contains no access token, private provider key or internal share-secret material. v2 JSON import is a later reviewed feature; do not route it through the v1 importer.
- [ ] Run v1 compatibility and migration tests; commit. Secure secret continuity is verified at deployment without printing secrets.

## Task 9: first-slice localization and privacy UX

**Files:** Create `frontend/src/locales/{en,ta}.json`, locale helper; modify new travel components and language menu. Create `docs/operations/privacy-and-retention.md`; extend browser tests.

**Interfaces:** Structured message keys with locale-aware dates/numbers/currency and fallback. v1 translation behavior remains intact; B strings are complete in English/Tamil after reviewer validation. Traveler translator is not part of this task.

- [ ] Test missing message key fallback, date/currency rendering, very long Tamil strings, keyboard focus across locale change, original-script place names and no loss of draft content. Add an RTL layout harness using test strings without advertising an unreviewed language as supported.
- [ ] Run browser cases and a key-coverage check; observe omissions before completion.
- [ ] Implement reviewed UI copy, evidence/status language and explicit cloud-upload consent. Display source names separately from translated labels. Document deletion timeline, source-cache retention, account deletion and local-device storage behavior; provide the corresponding reachable UI controls.
- [ ] Manually check Tamil with a competent reviewer and record their review scope. Run automated accessibility checks plus keyboard/screen-reader spot checks for discover, sign-in return, trip editor and export/delete dialogs.
- [ ] Run build and focused browser tests; commit. If reviewer access is unavailable, keep Tamil marked preview or defer full-localization claim; do not invent validation evidence.

## Task 10: integrated security, coverage and recovery acceptance

**Files:** Extend `tests/travel/test_rls.py`, `test_api.py`, `frontend/tests/travel.spec.ts`; create `docs/providers/qualification-YYYY-MM-DD.md`, `docs/operations/release-checklist.md`; modify CI workflow.

**Interfaces:** Local CI uses a real disposable Postgres/PostGIS service and contract provider fixtures. Staging live smoke is separately enabled with approved credentials/limits; no external quota use on every PR.

- [ ] Add the missing review-focus cases: reused pooled connection identity, viewer-like forged JWT metadata, ambiguous same-name results, Unicode query normalization, duplicate save after response loss, stale map/search error state, and legacy signature-key continuity. Test account deactivation and trip deletion revoke access immediately.
- [ ] Run `pytest tests/planning tests/travel -q`, `npm --prefix frontend run build`, and `npm --prefix frontend test`; inspect every failure, not only summary counts. The legacy distributed suite remains separately scoped; record known baseline rather than hiding it.
- [ ] Probe qualified live services with the 30-place coverage set, no bulk crawling, and record exact region/language/field gaps. Confirm tested result coordinates against independent permitted sources or known geographic boundaries. Include a rural India and non-India failure case if present; success on two cities is not global coverage proof.
- [ ] Run two-account HTTP/browser adversarial flows, rate-limit tests against stubs, a DB backup/restore drill, migration replay, provider-outage drill and API cold-start recovery. Inspect production bundle and logs for secrets; verify export licensing and attribution on map/cards/export.
- [ ] Commit acceptance records with exact environment/commit/time and limitations. Any unresolved ownership leak, license conflict, fabricated fallback or billed-resource requirement blocks B release.

## Task 11: deploy an explicitly free launch profile

**Files:** Update deployment config, environment examples and CI; create `docs/operations/zero-bill-deployment.md`, `restore.md`. Modify existing deployment docs only when implementation is approved and actual status changes.

**Interfaces:** Frontend points explicitly to v2-capable API; API has allowed origins, DB/auth/provider configuration and `free_only` mode. Secrets set through provider settings, never repository. Existing production can remain until replacement checks pass.

- [ ] Verify current free-plan commercial eligibility, inactivity/cold-start behavior, bandwidth/storage/connection quotas, region availability, backup capability and hard billing controls from official pages. Choose a free commercial-eligible static host for a commercial intent (Cloudflare Pages candidate); Vercel Hobby cannot be assumed eligible. Do not attach a card or enable automatic paid scaling in this task without separate user authorization.
- [ ] Exclude Render Free Postgres (30-day expiry, no backups). Verify Supabase Free DB/storage/egress/connection quotas, one-week inactivity pause, no automatic backups and encrypted manual/local backup procedure. Configure the authorized free DB/auth target; rehearse and apply reviewed migration only to that target. Deploy API on an eligible free host such as Render Free after connection exists; document idle sleep and filesystem ephemerality. Do not run persistent data in container-local SQLite or rely on an in-process daily quota counter. Auth redirect allowlist follows actual public hostname.
- [ ] Deploy preview artifacts and verify real public browser flow: signed-out India/non-India search, attribution/map, sign-in, save, reload, new browser session reopen, export, owner-only link, sign-out, second-account denial and deletion. Repeat at 360px in English/Tamil. Observe real network calls/DB state, not only static screenshots.
- [ ] Verify a cold-start wait, exhausted free quota, disabled provider, and paused/unavailable DB show recoverable state without fake data or paid fallback. Confirm service configuration has zero recurring paid resources and usage alerts/admission limits. A free tier can change; record date and recheck owner, not a lifetime guarantee.
- [ ] Promote only the verified artifact within the authorized deployment scope; record actual URLs, commit, schema version and test evidence. Keep rollback feature flags and the compatible legacy release. No release claim until public browser checks pass.

## Later scoped plans: qualify before implementing

### C: sourced regional itinerary planning

**Candidate files:** `app/travel/routing/{base,valhalla_or_provider}.py`, `hours.py`, `scheduling.py`, `solver_v2.py`, `costs.py`; frontend `PlanProposal.tsx`, `RevisionDiff.tsx`; tests `tests/travel/test_{routing,hours,solver_v2,money}.py`.

**Interfaces to design:** `route_matrix(points, mode, departure) -> SourcedMatrix`; `opening_windows(place_id, local_date) -> EvidenceWindows`; `propose_plan(trip_id, revision, constraints) -> Proposal`; `apply_proposal(trip_id, expected_version, proposal_id) -> TripRevision`. Provider choice follows free-credit/region qualification, not the filename suggestion.

- [ ] Verify licensed road-routing coverage for the pilot. Benchmark actual road routes, no-route cases, mode availability, matrix billing and quotas. Keep user-driven/manual plans functional when route quota is exhausted.
- [ ] Design venue fact ingestion with source URLs/verified times, exception dates and unknown hours. Agree who verifies Madurai/Chennai examples; no authored fake “real” schedule.
- [ ] Test visit completion within split/overnight windows; required vs optional stops; rest and walking bounds; unknown hours/cost status; unreachable points; 12-candidate/3-day/5-second draft limits; DST gap/fold, Asia/Kolkata offset, cross-timezone/date-line days and overnight lodging.
- [ ] Implement a separate v2 optimizer only after the tests and reviewed C spec. Preserve completed prefixes and original revision; proposals show before/after time, cost, uncertainty and accessibility impact. Unknown route/cost cannot become a feasible promise.
- [ ] Ship one qualified region, with real browser trip review and source freshness evidence. Publish coverage by mode/domain; expand only after the same checks.

### D: multilingual UI and traveler text tool

**Candidate files:** `app/travel/translation/{base,registry}.py` only if server execution fits ₹0; browser translation adapter and UI in `frontend/src/translation/`; reviewed phrase packs under `frontend/src/locales/phrases/`; benchmark records under `docs/providers/translation/`.

**Interfaces to design:** `get_supported_pairs() -> PairManifest`; `translate(text, source, target, consent) -> TranslationResult(original, translated, engine, model_version, source_language, target_language, warnings)`. Maximum draft text 2,000 characters. No API key to an assumed free hosted LibreTranslate service.

- [ ] Complete UI locale review first; evaluate browser-local translation availability on actual target devices. Unsupported browser/language pairs display unavailable and offer reviewed phrase packs. Chrome Translator API currently requires desktop Chrome 138+, user activation and runtime pair/model checks; it has no mobile/Firefox/Safari support. Browser-native capabilities must not be marketed as universally available or as an open-source hosted translation service.
- [ ] Evaluate explicitly licensed downloadable models only on user-local hardware or a verified free execution profile with measured RAM/latency. IndicTrans2 access/model terms and quality gates are separate; model research is not deployed inference.
- [ ] Benchmark native-script/code-mixed phrases, negation, allergy terms, numbers, currency and proper names with qualified reviewers. Preserve original text; distinguish translation from transliteration and UI localization.
- [ ] Design privacy/consent, pair capability manifest, translation-cache permissions and offline pack sizes; test unsupported pairs, interrupted download, quota exhaustion, private-text logs and original-fact preservation.
- [ ] Ship phrase packs/bounded translation only for passing pairs. Voice, camera and broad offline models each require a separate feasibility decision; no universal zero-cost promise.

### E: collaboration and expenses

**Candidate files:** `app/travel/{members,sharing,expenses}.py`, new migrations, frontend `Members.tsx`, `SharedTrip.tsx`, `TripBudget.tsx`; permission/monetary/browser tests.

- [ ] Review owner/editor/viewer matrix before adding tables or endpoints. Owner alone manages memberships/shares; editors change content, viewers only read. Define whether notes/expenses are included per share scope.
- [ ] Implement hashed, expiring, revocable read-only share tokens and invitation acceptance with identity checks. Reject role escalation, token reuse after revocation and direct-table bypass. Sanitized share views never include private identity or internal tokens.
- [ ] Add integer minor-unit money and exact currency metadata; store original amounts. Test INR/JPY/three-decimal currencies, sum rounding, refunds/negative amounts policy, missing exchange rates and duplicate expense retries. Dated conversion estimates must not be presented as bank quotes.
- [ ] Introduce revision-based concurrent editing and explicit conflict UX; do not begin with a CRDT. Test simultaneous reorder/delete and removed membership across list/detail/export/event endpoints.
- [ ] Verify two real collaborators and a revoked link in public browser, and preserve free export/owner access under quota constraints.

### F: durable fresh data without an always-on cost assumption

**Candidate files:** `app/travel/{freshness,ingestion,jobs,outbox,events}.py`, `workers/refresh.py`, migrations; frontend `FreshnessBadge.tsx`, `TripUpdates.tsx`; failure/replay tests.

- [ ] Qualify a real feed and exact redistribution/refresh rights. For a commercial launch, do not use Open-Meteo's noncommercial free service; disable it or choose an explicitly eligible zero-charge source. A paid plan is incompatible with this launch constraint.
- [ ] First deliver on-demand refresh: a user request fetches bounded covered facts, commits source revision/outbox durably and returns the observed/ingested times. Multi-client trip polling reads DB revision/ETag; it is labeled synchronization, not proof of a live traffic feed.
- [ ] Only introduce scheduled jobs on a verified eligible free scheduler/executor or user-operated local worker, with workload caps and cold-start constraints. No expectation a sleeping free API will execute background timers. Otherwise leave periodic ingestion unavailable.
- [ ] Define source-updated/observed/ingested/validity/expires fields and provider-specific stale policy; test absent timestamps, future clock skew, delayed/out-of-order/duplicate updates and source outage. “Fetched now” never overwrites unknown observation time.
- [ ] Add leased jobs, idempotent ingest and atomic outbox. Add SSE only if selected host supports bounded authenticated streams within free limits; use cursor replay and authenticated polling fallback. Test lost connections, overflow resync, revoked members, duplicate events and DB restart.
- [ ] Show a genuine externally changed fact reaching two clients with correct timestamps and a reversible replan proposal. If no live feed exists, release source-aware refresh only, with that limitation visible.

### G: open-source release and commercial experiments

**Candidate files:** `LICENSE` only after rights decision, `NOTICE`, `docs/licenses/`, contributor/developer/self-host docs, future pricing/experiment documents. Billing code is a separate later plan.

- [ ] Resolve upstream license permission or identify/reimplement the affected modules independently with documented provenance. Approve a license for original contributions; do not relabel the fork by assumption. Generate dependency/data/model notices and attribution checks.
- [ ] Make local setup and self-host deployment reproducible, including real-provider configuration, schema migrations, quota behavior, offline limitations and privacy. A self-host option shifts compute/electricity/maintenance cost to its operator; it does not make global services free.
- [ ] Conduct interviews and pilot measurement from the spec. Track search success, save/reopen completion, correction rate, actual support minutes and per-domain requests/credits with privacy-preserving telemetry.
- [ ] Test willingness to pay for defined future value using stated-price research without collecting money or making unstaffed promises. Confirm free-platform commercial eligibility before running a paid service. A future funded profile needs explicit approval because the launch requirement is ₹0.
- [ ] Use measured costs/usage to revise price hypotheses; design receipts/refunds/tax/cancellation only after a paid offering is justified. Core truthfulness, export and account ownership stay available at every tier.

## Draft self-review and handoff

The product spec's first slice maps to Tasks 1–11; later planning, translation, collaboration, freshness and business requirements map to separate C–G qualification sequences. No task assumes an unprovided Supabase project, connected Render account, paid key, universal map/translation coverage, or upstream software license. First-slice contract tests use fixtures strictly in tests; shipping acceptance uses actual provider/API/DB/browser behavior.

Before execution, the reviewer should resolve only these concrete choices: B scope; DB/auth target and free host accounts; rights-qualified map/search persistence; upstream rights path; and execution method. Existing authorization to draft does not approve implementation. Once those decisions are made, convert this B draft into a focused approved spec and plan, keeping the later roadmap separate. Do not ask for repeated permission to read code, refine this draft, or perform already authorized reversible preparation.
