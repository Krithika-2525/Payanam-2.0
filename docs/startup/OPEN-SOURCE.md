# Open-source routing comparison

GitHub API snapshot: 7 October 2026. Counts change. Read licenses and third-party/data terms before reuse; stars do not prove fit or quality.

| Project | Stars | License observation | Fit for Payanam |
|---|---:|---|---|
| [OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner) | 2,750 | [LGPL-3.0 license file](https://github.com/opentripplanner/OpenTripPlanner/blob/dev-2.x/lgpl-3.0.txt) | Closest mature scheduled-transit reference; requires appropriate transport feeds |
| [MOTIS](https://github.com/motis-project/motis) | 601 | [MIT](https://github.com/motis-project/motis/blob/master/LICENSE) | Multimodal routing candidate; permissive integration subject to dependencies and data rights |
| [Valhalla](https://github.com/valhalla/valhalla) | 6,290 | [MIT in COPYING](https://github.com/valhalla/valhalla/blob/master/COPYING) | Potential future road travel matrix source |
| [VROOM](https://github.com/VROOM-Project/vroom) | 1,880 | API reports BSD-2-Clause | Useful for fleet optimization; not a complete family itinerary product |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | 11,813 | [BSD-style three-condition license](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt) | Future interactive map renderer; tiles/geocoding need their own terms |

Recommendation: retain OR-Tools for opening sessions, dwell, rest and hard group budgets. Validate a local operator market first, then evaluate Valhalla for better travel estimates and MOTIS/OpenTripPlanner for real scheduled transit. Do not add a service solely for its stars. Current map is an original geographic SVG sketch, not navigation.

Payanam upstream has no observed license file. This branch preserves upstream authorship/history and adds new product code; no license has been invented for someone else's work. Resolve commercial code rights with the owner before monetization. No source from these comparison projects was copied into this release.
