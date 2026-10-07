# Payanam real-data and zero-cost research

Research date: 7 October 2026, Asia/Calcutta. Architectural draft evidence, not a claim that these integrations have been implemented. Prices, terms, quotas and repository activity must be rechecked before release. User requirement: **strictly ₹0 recurring infrastructure cost**.

## Recommendation

Keep the existing React/Vite and FastAPI product while comparing TREK in a bounded technical spike. Use MapLibre with OpenFreeMap for a real global basemap, a quota-controlled Geoapify adapter for discovery, and portable PostgreSQL/PostGIS for user-owned trips. Supabase Free is a candidate for database and authentication when the project ID is supplied. Render Free can host a low-volume API with cold starts; it cannot support an always-on travel service. The current Vercel links can remain a personal preview, but Vercel Hobby is not a free commercial startup hosting plan.

Use human-reviewed UI translations and phrasebooks on every supported browser. Add on-device translation as an optional enhancement where supported. Do not describe this as universal translation. Global map coverage, global business search, live traffic, verified opening hours and real-time transport feeds are separate capabilities.

## Closest open-source products

Repository metadata was read directly from the public GitHub API on 7 October 2026. Stars are a dated discovery signal, not a quality or security certification. These products have not undergone a code or deployment audit for this project.

| Project | Stars observed | License evidence | Relevance and decision |
| --- | ---: | --- | --- |
| [TREK](https://github.com/liketrek/TREK) | 14,619 | AGPL-3.0, API and repository README | Closest product alternative: day boards, maps, budgets, collaboration, offline sync, reservations and journal. Evaluate adopting it versus extending Payanam before rebuilding commodity features. Network-served modifications require corresponding source under AGPL. |
| [AdventureLog](https://github.com/seanmorley15/AdventureLog) | 3,793 | Actual repository LICENSE contains GPL version 3; GitHub API reports NOASSERTION | Travel tracking and planning reference. Validate the complete license and bundled assets before reuse. |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | 11,814 | Repository LICENSE.txt: BSD-3-Clause, plus bundled notices | Interactive map renderer; does not provide hosted tiles, geocoding, routing or traffic. |
| [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) | 16,997 | AGPL-3.0 | Translation engine reference. Self-hosting needs compute; its managed public API is not an unlimited free service. |
| [Photon](https://github.com/komoot/photon) | 3,101 | Apache-2.0 | Multilingual OSM geocoder. Public demo is unsuitable as an uncapped production dependency. |
| [IndicTrans2](https://github.com/AI4Bharat/IndicTrans2) | 478 | Repository code MIT; model weights/access terms must be checked separately | Future Indian-language model evaluation, not a free hosted API available for immediate use. |

TREK's [README](https://github.com/liketrek/TREK/blob/main/README.md) advertises MapLibre/OpenFreeMap, OSM place enrichment, OSRM routes, Open-Meteo forecasts, multi-currency budgets, 23 UI languages and offline collaboration. These are upstream claims, not independently verified product behavior. Its provider defaults need our own policy review; copying a working integration does not establish commercial API eligibility. Its listed UI languages do not include Tamil or Hindi, leaving an India-first opportunity to test rather than a proven competitive advantage.

The original [Payanam repository](https://github.com/AnanthaBhalan/Payanam-2.0) had no detected LICENSE and zero stars in the same API observation. A public repository is not automatically licensed for open-source redistribution. Resolve upstream rights before declaring the entire fork open source; if rights cannot be resolved, assess a clean replacement on a clearly licensed foundation. Do not silently relabel upstream code.

## TripMapper product and UI reference

Reviewed [homepage](https://www.tripmapper.co/), [features](https://www.tripmapper.co/features), [personal pricing](https://www.tripmapper.co/pricing), [business product](https://business.tripmapper.co/) and [business pricing](https://business.tripmapper.co/pricing). Also visually reviewed its public marketing desktop product image.

Useful patterns: day columns with category-labelled cards, optional photographs, a compact list view, time/cost fields and persistent Card/List/Budget navigation. The proposed Payanam version should pair the day board with a real map, offer mobile map/list switching, keyboard-accessible reorder controls, readable local-script names and visible source/freshness indicators. Keep an original visual identity and assets. Goibibo remains a reference for a clear destination/date entry form; do not imply live bookings or imitate its branding.

Observed personal pricing: Trip Free and Trip+ £3.99/month in the displayed GBP monthly variant. Business pricing in the displayed EUR monthly variant: Cabin €89.99, Suitcase €244.99, Trunk €424.99, Private custom. Billing period and currency selection affect comparisons. The plain-text scrape cannot reliably distinguish disabled/included feature checkmarks; no exact free-versus-paid feature allocation is asserted here.

## Providers and constraints

| Capability | Evidence | Implication for a ₹0 launch |
| --- | --- | --- |
| World basemap | [OpenFreeMap](https://openfreemap.org/): public instance free, commercial use allowed, no keys, no stated request/view limits, no SLA. Project MIT; underlying OSM data ODbL and style/font notices remain relevant. | Recommended map default with configurable endpoint, attribution and map-unavailable fallback. A free basemap is not a live traffic API. |
| Places/search/routes | [Geoapify pricing](https://www.geoapify.com/pricing/), [credit details](https://www.geoapify.com/pricing-details/), [homepage FAQ](https://www.geoapify.com/), [terms](https://www.geoapify.com/terms-and-conditions/): free commercial production within limits, 3,000 credits/day, no credit card required, mandatory Geoapify follow-link and underlying data attribution. | Proxy requests, reserve credits atomically with headroom, restrict account/key access, stop requests before the allowance, and never auto-upgrade. Provider terms allow suspension or possible overage charges; verify account-level zero-billing behavior before launch. |
| Cached places | Geoapify homepage explicitly allows caching/storing, redistribution according to terms. [Reverse-geocoding FAQ](https://www.geoapify.com/reverse-geocoding-api/) allows indefinite result storage with attribution. | Persist normalized results with provider ID, OSM identity where available, source/license/attribution and fetched timestamps. Bulk redistribution and combined OSM databases need separate ODbL review. |
| Credit accounting | Geoapify: autocomplete/geocode one credit; Places up to 20 results one credit, another credit per additional 20; route matrices use `max(N,M) × min(N,M,10)` credits. Routing cost grows with waypoint pairs and long-distance increments. | Do not budget every HTTP request as one credit. Large route matrices can exhaust the allowance quickly. Use bounded stops, single-day matrices, cache permitted results and return a quota state. |
| Nominatim public service | [OSMF policy](https://operations.osmfoundation.org/policies/nominatim/): aggregate application maximum one request/second, identifying client, caching, attribution; autocomplete and systematic harvesting forbidden. | Do not use the public endpoint for typeahead or global POI ingestion. A self-hosted deployment is a separate infrastructure decision. |
| Photon | [README](https://github.com/komoot/photon): demo throttles/bans extensive use and offers no availability guarantee. Planet database around 95 GB in 2026; roughly 64 GB RAM recommended for smooth use. | Useful research or small explicitly permitted requests; full-world self-hosting does not fit free cloud resources. Regional/user-hosted deployment is a later option. |
| Weather | [Open-Meteo pricing](https://open-meteo.com/en/pricing): hosted free API is noncommercial, 10,000 calls/day and 300,000/month; commercial Standard starts at $29/month. Code AGPL and data CC BY 4.0 do not override hosted-service terms. | Disable by default for a commercial ₹0 launch unless a separately eligible free source is verified. Model forecasts/current estimates must not be labelled observed live weather. |
| Machine translation | [LibreTranslate documentation](https://docs.libretranslate.com/): self-hosted AGPL engine, installed language matrix; managed libretranslate.com requires a paid key. | No mandatory hosted translation subscription. Optional user-hosted endpoint; no global language guarantee. |
| On-device translation | [Chrome Translator API](https://developer.chrome.com/docs/ai/translator-api): desktop Chrome 138+, no mobile support; runtime pair checks, user activation and model downloads required. Listed languages include Tamil, Hindi, Bengali, Kannada, Marathi and Telugu. | Progressive enhancement only. Preserve originals and show unsupported/unavailable states on mobile, Firefox and Safari. Browser-vendor support is not an open-source Payanam service. |
| Indian-language models | [IndicTrans2 English–Indic model card](https://huggingface.co/ai4bharat/indictrans2-en-indic-1B): gated weights; no listed inference provider in this observation; research covers 22 scheduled languages across model variants. | Future benchmark after access/license and resource review. No zero-cost universal hosted model claim. |

## Hosting and database

| Platform | Verified official constraint | Recommendation |
| --- | --- | --- |
| [Vercel Hobby](https://vercel.com/docs/plans/hobby) | Noncommercial personal use only; usage features can pause at limits. | Existing personal preview can remain. Commercial hosted launch cannot assume free Hobby eligibility. Verify the actual account plan before release. |
| [Render Free](https://render.com/docs/free) | API sleeps after 15 minutes idle; waking takes about a minute; ephemeral local disk; 750 shared instance-hours/month; free services can suspend at limits. Provider says not to use free instances for production. | Best-effort pilot API only, with visible wake/retry state and saved offline plans. No background always-on worker or keepalive scheme. Avoid payment-linked overage risk. |
| Render Free Postgres | Expires after 30 days; 14-day upgrade grace before deletion; no backups. | **Do not use for lasting trip storage.** |
| [Supabase Free](https://supabase.com/pricing) | 500 MB database, 5 GB egress plus 5 GB cached egress, 1 GB object storage, two active projects, pause after one week inactive, no automatic backups or uptime SLA. | Candidate portable Postgres/PostGIS/Auth target. Await project ID and verify free account. No worldwide POI mirror, video uploads or indefinite audit-log growth. Add owner-scoped RLS and encrypted manual/local backups. |
| [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/) and [Free plan](https://www.cloudflare.com/plans/free/) | Free static hosting; 500 builds/month, 20,000 files/site, 25 MiB single-asset limit. Functions have separate Workers allowances. Free plan describes availability for all websites. | Commercial static-hosting candidate when Vercel Hobby is ineligible. Confirm applicable account/product terms and quotas before committing to deployment; no paid add-ons or Workers assumption. |

₹0 is a **bounded pilot profile**, not an always-on industry service guarantee. Use provider subdomains; a purchased domain is excluded. Human work, travellers' device/data costs, and optional self-hosting on existing hardware are not zero-resource claims. Stop at quota limits rather than shift silently to a billed provider. A paid business launch needs a separately funded operating model.

## Low-volume live research probes

Three read-only requests were made on 7 October 2026 around 12:01 Asia/Calcutta. These were architecture checks, not implemented application integrations, availability tests or freshness validation.

| Request | Result observed |
| --- | --- |
| `https://tiles.openfreemap.org/styles/liberty` | HTTP 200, MapLibre style version 8. |
| `https://photon.komoot.io/api/?q=Madurai&limit=2` | HTTP 200, real Madurai city result in India: longitude 78.1140983, latitude 9.9261153, OSM relation 11268397; also an administrative result. |
| `https://photon.komoot.io/api/?q=Paris&limit=2` | HTTP 200, real Paris city result in France: longitude 2.3483915, latitude 48.8534951, OSM relation 71525; also an administrative result. |

These results demonstrate that accessible sources return Indian and international location records. They do not verify current opening hours, business existence, route ETA, universal coverage or source update lag. A fetched timestamp records retrieval; a provider's observation timestamp, when available, is a separate field.

## Release evidence still required

1. Resolve upstream licensing, choose extend-versus-adopt after a documented TREK spike, and verify dependency/model/data notices.
2. Obtain a free Geoapify account/key and verify zero-billing enforcement and exact endpoint limits. No bulk seed scraping or multi-account quota evasion.
3. Obtain the intended database project ID and authenticate connected deployment providers. Supabase was previously deferred; this draft does not create a cloud database.
4. Verify maps, discovery, authenticated ownership, persistence, timezone behavior, quota exhaustion, offline fallback and stale/unknown data against the implemented release.
5. Publish a capability matrix per region/language. Traffic, flight status, booking inventory and transport feeds remain unavailable until legitimate feeds and free eligibility are demonstrated.

The full design and implementation sequence are in the accompanying Astra draft under `docs/superpowers/`. No additional provider integration is live merely because it is listed here.
