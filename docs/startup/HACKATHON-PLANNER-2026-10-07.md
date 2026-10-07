# Payanam hackathon: turn a city into a journey

## Product
For a traveler who knows where to go but does not know how the days should fit together. Search a city, explore sourced nearby places, choose dates/pace/interests and generate an ordered itinerary with timing, lunch and return travel. Keep control through manual editing and recalculation; take the trip along through notes, expenses, packing, JSON, calendar and print. India is a first-class starting point; global GeoNames cities and OSM coverage support international trips. ₹0 to run the current noncommercial evaluation on existing Vercel free projects; no hosted model, card or paid resource. Pricing in the hackathon app is simply free.

Differentiator: practical constraints and transparent facts. Each stop comes from a real source; hours can be unknown, a required stop can be infeasible, and travel estimates are labelled. Personal budget tracking uses the traveler's amounts, never invented ticket prices. The planner still works if weather or private cloud storage is down.

## Proven projects reviewed
Live GitHub API counts checked 7 October 2026. Stars indicate interest, not measured active travelers or proof of international adoption.

| Project | Stars | License | Useful pattern / actual reuse |
| --- | ---: | --- | --- |
| [TREK](https://github.com/liketrek/TREK) | 14,622 | AGPL-3.0 | Benchmark for daily plans, mapped POIs, budgets and packing. No code copied. |
| [TRIP](https://github.com/itskovacs/trip) | 1,947 | MIT | Benchmark for a focused POI map and portable multi-day trip. No code copied. |
| [Travel-Mate](https://github.com/project-travel-mate/Travel-Mate) | 1,340 | MIT | Benchmark for city-first travel discovery. No code copied. |
| [OR-Tools](https://github.com/google/or-tools) | 14,156 | Apache-2.0 | Actually used for constrained daily routing, optional stops, time windows and visit caps. |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | 11,813 | BSD-3-Clause | Actually used for real map, selectable POI markers and route overlay. |
| [Open-Meteo](https://github.com/open-meteo/open-meteo) | 6,299 | Server AGPL-3.0; data CC BY 4.0 | Free noncommercial hosted forecast API integration; no server code incorporated. |

The original Payanam upstream lacks a LICENSE. Original additions and licensed dependencies do not establish permission to license the entire fork as open source; resolve that before a blanket public-license claim. The hackathon source branch is reviewable and source available.

## API and operational choices
- OSM/Overpass: keyless named nearby attractions, museums, heritage, parks, sacred places, viewpoints and tagged restaurants. Bounded 8-km query, capped output, two in-flight requests, 60-second city cooldown, single-flight and 128-city memory cache. Sourced ODbL snapshots provide reliable evaluation destinations; explicit refresh shows the retrieved date or a dated fallback.
- The round-robin overpass-api.de host frequently returned upstream 503/504 and quota errors during qualification. The official Commons manual permits selecting an individual server to work around a broken peer. gall.openstreetmap.de succeeded for Paris; this evaluation uses that documented workaround. Do not mistake this for a scalable service SLA or use multiple instances to evade quotas.
- [Overpass Commons](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) explicitly discourages relying on public instances as a mass-market app backend. Keep the hackathon low-volume. Next scale step: licensed regional extracts / managed provider within a funded plan, not more public-server hammering.
- [Open-Meteo](https://open-meteo.com/): no key for noncommercial evaluation; cached 14-day daily forecasts, displayed units/dates and source. Forecasts outside that horizon remain unavailable. Weather never blocks planning.
- Routing: geometric speed/detour estimates use no external API. Map connectors are dashed and link to a real directions app. Optional openrouteservice adapter stays disabled under the user's no-key selection; a free key plus explicit zero-billing confirmation can enable road geometry later. No live traffic claim.
- Existing Supabase-compatible JWT/Postgres/PostGIS/RLS backend persists the planning envelope and provider snapshots when configured. Actual limited-role local DB and cryptographic identity fixtures verify private saves. User-selected Supabase target and identity provider setup remain deferred; guest generation and device workflows are fully usable now.
- Render blueprint remains ready. Existing connected Render account expired; no service created. Current evaluation uses the already-existing Vercel frontend and Python API, avoiding an extra hosting dependency.

## Team perspectives
CEO: complete one compelling loop for hackathon judges—city to feasible itinerary to portable trip—before collaborations or bookings.
CTO: real provider contracts, deterministic constraints, bounded free-service use, private owner isolation, explicit unknowns, no LLM dependency.
CFO: no recurring paid infrastructure, no keys that permit unbounded billing; snapshots and caching reduce evaluation calls. Free-tier quotas and terms still govern availability.
COO: explicit snapshot update script, source/date evidence, rerunnable CI, provider outage fallback, calendar/print portability, and documented deferred cloud configuration.

## Qualified fallback and snapshot coverage
Public OSM service reliability also required an independent source. The keyless Wikipedia API is used for geographic articles only when their categories identify a museum, park, sacred place, heritage site or attraction; event/attack/defunct categories and generic city/district articles are excluded. These records have their own Wikipedia source links and CC BY-SA 4.0 attribution; no opening hours, fees or venue availability are invented. This is an encyclopedia fallback, with source-specific coverage limitations, not a claim of an authoritative tourism registry.

The bundled dated corpus contains 12 destinations and 678 sourced records: Madurai, Chennai, Jaipur, New Delhi, Mumbai, Bengaluru, Kochi, Paris, Tokyo, London, Singapore and Bangkok. Exact source/date/count/hour coverage is in `docs/providers/hotspot-coverage-2026-10-07.csv`. Other cities query bounded OSM discovery, then independently qualified Wikipedia places if OSM fails and no snapshot exists. Both sources can be sparse or unavailable; that state is visible.
