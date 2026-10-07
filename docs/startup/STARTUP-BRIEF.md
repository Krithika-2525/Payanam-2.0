# Payanam: startup brief

Draft recommendation — 7 October 2026. Market choice and prices are hypotheses, not customer validation. Fork: https://github.com/Krithika-2525/Payanam-2.0. Source inspected: 82aaa8979c8e4bcfca1497772261b759973580a8. The source was cloned and extended on `feat/payanam-web`. A public planning release is live; see [deployment status](../DEPLOYMENT-STATUS.md) for verified checks and current hosting. Market, prices and pilot goals below remain proposals.

## Purpose and soul

Payanam helps families make meaningful journeys with less uncertainty. Promise: **Travel with confidence. Keep the moments that matter.**

A family traveling with older parents cares about completing a meaningful visit, having time to rest, knowing the cost, and having someone to call when transport fails. Optimize for those outcomes. Speak with warmth and specificity. Respect different beliefs and accessibility needs. Never present invented temple history, guaranteed darshan, or a simulated reservation as fact.

Product story: “Tell us what matters on this journey. We build a realistic plan around it, explain the trade-offs, and help you adapt when the day changes.” Narrative development is interpreted here as brand story and explanations throughout the journey; confirm if a different meaning was intended.

## CEO: initial market and strategic choices

Recommended payer: independent Tamil Nadu pilgrimage and cultural-tour operators, initially serving small family groups through an operator-assisted service. Traveler: adult family organizer, often coordinating older relatives. Begin with one operator-selected circuit around Madurai and nearby destinations; validate route feasibility and partner coverage before offering it.

Three options:

| Approach | Opportunity | Main difficulty | Decision |
|---|---|---|---|
| Operator-assisted planning and recovery | Existing customer channels, measurable operator time savings, manageable human support | Operator adoption and reliable local data | Start here |
| Consumer trip planner | Broad audience, direct brand relationship | Acquisition cost, infrequent repeat use, crowded category | Consider after paid pilots |
| Routing API for travel businesses | Strong fit with backend technology | Data quality, integration cycles, service expectations | Later if pilots show demand |

The initial product is planning software with operator support. The operator retains responsibility for supplier bookings and fulfillment. Supplier marketplace and automated paid bookings require a later design and commercial agreements.

## Competitive research

Research uses public search excerpts retrieved 7 October 2026; it is a selected comparison, not an exhaustive market survey. Vendor descriptions do not prove performance. Unmentioned competitor features are unknown rather than absent.

| Alternative | Verified overlap | What Payanam must validate |
|---|---|---|
| [Trawell Tamil Nadu packages](https://www.trawell.in/tour-packages/tamilnadu) | Regional packaged travel | Whether flexible family schedules and operator recovery tools improve current service |
| [IRCTC Bharat Gaurav](https://www.irctctourism.com/bharatgaurav) | Cultural and religious tourist circuits | Whether small-group flexibility creates a distinct buying reason |
| [Wanderlog Tamil Nadu planner](https://wanderlog.com/tp/86691/tamil-nadu-trip-planner) | Places, reservations, maps, day-by-day itineraries | Whether verified opening sessions and operator support justify payment |
| [Rome2Rio](https://www.rome2rio.com/) | Multimodal A-to-B transport discovery | Whether scheduling multiple meaningful visits with recovery adds value |
| [Trip Planner AI / Layla](https://tripplanner.ai/) | Personalized AI itineraries and described itinerary changes | Local data accuracy and operator-assisted execution; AI alone is not differentiation |
| [Travel Booster](https://www.travelbooster.com/sectors/) | Operator software, tailored itineraries and proposals | Whether a narrow, simpler regional workflow meets underserved operators' needs |
| [OpenTripPlanner](https://github.com/opentripplanner/OpenTripPlanner) | Open-source multimodal public transport routing | Technical reference or future integration; verify feed availability and licensing |
| [MOTIS](https://github.com/motis-project/motis) | Multimodal routing; real-time GTFS support described by [IDB](https://knowledge.iadb.org/en/open-knowledge/code-development/open-source-solution/motis-project) | Technical reference; not proof Tamil Nadu data is available |

Closest commercial comparisons are regional tour operators and itinerary software; closest engineering comparisons are OpenTripPlanner and MOTIS. No evidence yet supports calling Payanam unique. Potential defensibility: verified local operational data, trusted operator relationships, and measured recovery outcomes accumulated with consent.

## Product: first valuable experience

1. Operator enters date, group size, starting point, must-see places, budget, pace, and mobility preferences.
2. Payanam proposes a feasible day with visit duration, rest intervals, travel estimates, price assumptions, and opening-hour sources.
3. Operator reviews and edits the plan, then shares a traveler view with Tamil and English explanations.
4. A disruption highlights impacted visits and presents alternatives with incremental cost and schedule changes.
5. Traveler or operator explicitly approves a change. The operator arranges transport; the product records confirmation separately from the proposed plan.

Voice examples: “We placed this visit in the morning because the verified schedule has an afternoon closure.” “The delay may affect your next visit. Your operator is reviewing two options.” If the source is stale, say so. Explain alternatives from structured facts, not generated guesses.

## CTO: actual source and technical direction

Current code: FastAPI, OR-Tools, Temporal, Ray Jobs, Memgraph, Kafka/Redpanda, Redis fleet indexing, sample Tamil Nadu topology, and tests. Repository contains no customer frontend. Preserve the Python backend and avoid a language rewrite before demand is established.

Observed gaps:

- Rail booking activity simulates partner I/O and generates receipts; the booking dictionary is process-local. This is not a production ticketing integration.
- Route APIs expose workflow identifiers without observed identity/ownership checks. Driver telemetry also needs authenticated access.
- CORS is wildcard with credentials enabled; replace with explicit permitted origins in production.
- Async route creation calls a synchronous local solver with a three-second limit; move work off the request event loop.
- RouteStatusResponse declares only workflow_id and run_id while the handler supplies status, state, and result. Verify and repair the response contract.
- Multi-window BoolOr is unconditional, which can require optional multi-window destinations to be visited. Test optional visits and guard the window choice by visited status.
- Travel-time propagation omits node dwell duration; opening constraints check arrival rather than completion. Reproduce with meaningful visit-duration cases before changing the solver.
- Fare is reported but cost_expr is not used in the objective, and the request has no hard monetary budget. Add explicit budget semantics.
- Seeded probabilities and graph data are examples, not calibrated live reliability or contracted transport inventory.
- No license file was observed. Confirm rights with the upstream owner before commercial reuse; GitHub fork permission does not establish a commercial code license.

First release should expose a separate planning-only flow with no supplier side effects. Use the existing local solver through an isolated worker/executor; bound requests and queue capacity. Retain Temporal workflows for later booking/recovery integration rather than requiring the full distributed stack to render a planning demo. Add durable relational storage for operators, plans, revisions, approvals, and supplier references when the authenticated pilot is built. Choose hosting after requirements and budget are agreed.

## CFO: testable pricing and economics

Pricing experiments: operator subscription at INR 2,999/month including 100 published plans; additional plans INR 29 each. Optional operator-delivered traveler assistance priced at INR 499/trip only after scope and cost responsibility are agreed. No pricing is validated. Do not double-charge the same service or promise 24-hour support without staffing.

Illustrative subscription economics per operator-month:

| Item | Assumed INR |
|---|---:|
| Subscription receipts excluding GST | 2,999 |
| Payment fees, assumed 3% | 90 |
| Hosting/data allocation | 300 |
| Support: 2 hours at INR 300/hour | 600 |
| Contribution before salaries, acquisition, overhead, taxes | 2,009 |

Illustrative contribution margin: 67%. At an assumed acquisition cost of INR 6,000, simple contribution payback is about 3 months; this excludes churn and onboarding. For INR 150,000 monthly fixed costs, about 75 such operators cover fixed costs only if these assumptions hold. 20 operators generate INR 59,980 monthly subscription revenue and INR 40,180 contribution, not profit.

Assistance priced at INR 499 with INR 15 fees, INR 180 labor, and INR 50 service reserve contributes INR 254, assuming the operator absorbs transport charges and supplier refunds under separately disclosed terms. Recalculate using actual support time. GMV is not revenue; customer travel funds and refunds must not be treated as available operating cash.

Founder-led 90-day planning envelope: engineering INR 180,000; data/partner verification INR 45,000; hosting/tools INR 15,000; pilot travel/research INR 30,000; legal/accounting INR 30,000; contingency INR 45,000. Total INR 345,000, excluding founder salary and any travel inventory. These are budget assumptions, not vendor quotations. Match scope to available cash before hiring.

## Operations and launch

Founder owns sales and product. One engineer owns delivery. A part-time regional coordinator verifies places, schedules, and partner availability. Accountant/legal adviser sets invoicing, taxes, commercial code rights, customer terms, privacy, and supplier responsibilities. No executive hiring is necessary for the pilot.

Days 1–14: interview 10 operators and 15 family organizers; inspect recent real itineraries and disruption cases with consent; identify one covered circuit. Measure current planning time, support burden, and willingness to pay. Do not contact people without the user's explicit instruction.

Days 15–30: build and verify planning-only demo; obtain opening-hour sources; run 20 historic itinerary cases with operators. Target median plan creation below 5 minutes and no accepted plan violating verified hard constraints.

Days 31–60: pilot with 3 operators and 30 consenting family trips. Human review on every published plan. Record baseline vs new planning time, missed must-see visits, support minutes, and user comprehension.

Days 61–90: seek 5 paying operators. Continue only if operators demonstrate at least 30% planning-time reduction, at least 80% of reviewed plans need no major correction, and actual contribution is positive. These are proposed gates, not achieved results. With fewer than 3 willing paid pilots after 10 qualified demos, revise the problem or stop expansion.

Track: paid operators, activation to first published plan, plans per active operator, must-see completion, source freshness, disruption handling time, support cost, contribution, and retention. Keep incident definitions and denominators consistent. Avoid optimizing page views as a business outcome.

## Decisions and limits

Recommendation: proceed to a reviewed design for the planning-only release, then authenticated operator pilot, then commercial integrations. The planning site is deployed. Company incorporation, supplier agreements, payments and customer outreach remain future work. A startup becomes real through validated paying demand and reliable delivery; this brief sets up that work.
