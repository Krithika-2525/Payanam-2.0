# Verified deployment status

The current release is a real-data, no-key hackathon itinerary planner, verified 7 October 2026. Read the [current deployment evidence](operations/deployment-2026-10-07.md) for source/deployment IDs, public journey checks, passing CI and limits.

| Resource | Actual status | Link |
|---|---|---|
| Frontend | Vercel READY; public | https://payanam-journeys.vercel.app |
| Planning API | Vercel READY; real city/hotspot/itinerary endpoints | https://payanam-planning-api.vercel.app/docs |
| Source | Reviewed product branch `feat/payanam-global` | https://github.com/Krithika-2525/Payanam-2.0/pull/2 |
| Supabase | DB/Auth backend tested locally; hosted target deferred | [Integration guidance](SUPABASE-INTEGRATION.md) |
| Render | Free blueprint prepared; expired connection, no service created | [₹0 deployment guidance](operations/zero-bill-deployment.md) |

Current evaluation approach: existing Vercel frontend plus Python API, keyless providers and device trip storage. No recurring paid infrastructure was added. Hosted private saves require the owner's later Supabase configuration; they are not currently enabled. Source dates and geometric travel estimates are shown explicitly. The old illustrative Madurai planner remains at `?mode=demo`; the preserved distributed prototype is a separate, unqualified baseline.
