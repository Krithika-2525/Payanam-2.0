"""Bounded CP-SAT planning; results carry an integrity signature for replanning."""
import hashlib
import hmac
import json
import os

from ortools.sat.python import cp_model

from .catalog import DATASET_VERSION, DISCLAIMER, HUB, PLACES, travel_options
from .models import PlanRequest, PlanResult, ReplanRequest, Stop, minutes


def _signature(plan: PlanResult) -> str:
    payload = json.dumps(plan.model_dump(mode='json', exclude={'signature'}), sort_keys=True, separators=(',', ':'))
    secret = os.environ.get('PAYANAM_PLAN_SECRET', 'local-development-only-payanam').encode()
    return hmac.new(secret, payload.encode(), hashlib.sha256).hexdigest()


def _seal(plan: PlanResult) -> PlanResult:
    plan.signature = _signature(plan)
    return plan


def _solve(request: PlanRequest, origin_id: str, start: int, budget: int, excluded: set[str], limit: int) -> PlanResult:
    ids = [id for id in request.required_place_ids + request.optional_place_ids if id not in excluded]
    result = PlanResult(feasible=False, status='infeasible', request=request,
                        disclaimer=DISCLAIMER, dataset_version=DATASET_VERSION, finish_min=start, progress_min=start)
    if not ids or limit <= 0:
        return result
    origin = HUB if origin_id == HUB.id else PLACES[origin_id]
    nodes = [origin] + [PLACES[id] for id in ids]
    model = cp_model.CpModel()
    end = minutes(request.end_time)
    visited, arrival, departure = {}, {}, {}
    rest = 20 if request.pace == 'relaxed' else 10
    dwell_extra = 15 if request.pace == 'relaxed' else 0
    arcs = []
    selected_arcs = []
    for i, place in enumerate(nodes[1:], 1):
        visited[i] = model.new_bool_var(f'visit_{i}')
        arrival[i] = model.new_int_var(0, end, f'arrival_{i}')
        departure[i] = model.new_int_var(0, end, f'departure_{i}')
        model.add(arrival[i] == 0).only_enforce_if(visited[i].Not())
        model.add(departure[i] == 0).only_enforce_if(visited[i].Not())
        model.add(departure[i] == arrival[i] + place.dwell_minutes + dwell_extra + rest).only_enforce_if(visited[i])
        hits = []
        for k, (a, b) in enumerate(place.windows):
            hit = model.new_bool_var(f'window_{i}_{k}')
            hits.append(hit)
            model.add(arrival[i] >= a).only_enforce_if(hit)
            model.add(departure[i] <= b).only_enforce_if(hit)
        model.add(sum(hits) == visited[i])
        arcs.append((i, i, visited[i].Not()))
        back = model.new_bool_var(f'finish_{i}')
        arcs.append((i, 0, back))
        if place.id in request.required_place_ids:
            model.add(visited[i] == 1)
    for i, first in enumerate(nodes):
        for j, target in enumerate(nodes[1:], 1):
            if i == j:
                continue
            for mode, travel, cost in travel_options(first, target, request.party_size, request.transport):
                arc = model.new_bool_var(f'{i}_{j}_{mode}')
                arcs.append((i, j, arc))
                selected_arcs.append((i, j, mode, travel, cost, arc))
                predecessor_end = start if i == 0 else departure[i]
                model.add(arrival[j] >= predecessor_end + travel).only_enforce_if(arc)
    model.add_circuit(arcs)
    model.add(sum(visited.values()) >= 1)
    model.add(sum(visited.values()) <= limit)
    cost_expr = sum(cost * arc for _, _, _, _, cost, arc in selected_arcs)
    model.add(cost_expr <= budget)
    finish = model.new_int_var(0, end, 'finish')
    model.add_max_equality(finish, list(departure.values()))
    model.minimize(-1000000 * sum(visited.values()) + finish * 100 + cost_expr
                   + sum(arrival.values()))
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 3.0
    solver.parameters.num_search_workers = 1
    solver.parameters.random_seed = 0
    status = solver.solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        result.status = 'timeout' if status == cp_model.UNKNOWN else 'infeasible'
        result.suggestions = ['Start earlier or finish later to fit complete visits into opening sessions.',
                              'Increase the group transport budget, or try the bus option.',
                              'Make one must-see visit optional or choose fewer destinations.']
        return result
    chosen = {i: (j, mode, travel, cost) for i, j, mode, travel, cost, arc in selected_arcs if solver.value(arc)}
    current, previous_end = 0, start
    while current in chosen:
        j, mode, travel, cost = chosen[current]
        place = nodes[j]
        at, leave = solver.value(arrival[j]), solver.value(departure[j])
        result.stops.append(Stop(place_id=place.id, name=place.name, tamil_name=place.tamil_name,
            arrival_min=at, departure_min=leave, dwell_minutes=place.dwell_minutes + dwell_extra,
            rest_minutes=rest, travel_minutes=travel, wait_minutes=at - previous_end - travel,
            mode=mode, cost_inr=cost, lat=place.lat, lon=place.lon,
            explanation=f'This visit fits an example opening session, with {place.dwell_minutes + dwell_extra} minutes to explore and {rest} minutes to rest.'))
        current, previous_end = j, leave
    result.feasible = True
    result.status = 'optimal' if status == cp_model.OPTIMAL else 'feasible'
    result.total_cost_inr = sum(s.cost_inr for s in result.stops)
    result.total_travel_minutes = sum(s.travel_minutes for s in result.stops)
    result.finish_min = previous_end
    result.skipped_place_ids = [id for id in ids if id not in {s.place_id for s in result.stops}]
    return result


def solve_plan(request: PlanRequest) -> PlanResult:
    return _seal(_solve(request, HUB.id, minutes(request.start_time), request.budget_inr, set(), request.max_stops))


def replan(request: ReplanRequest) -> PlanResult:
    original = request.original_plan
    if not hmac.compare_digest(original.signature, _signature(original)) or original.dataset_version != DATASET_VERSION:
        raise ValueError('The original plan has changed or belongs to another dataset. Create a fresh plan.')
    if not original.feasible or request.completed_count >= len(original.stops):
        raise ValueError('Choose a completed prefix with at least one visit remaining.')
    if request.completed_count < original.completed_count:
        raise ValueError('Previously completed visits cannot become pending again.')
    prefix = original.stops[:request.completed_count]
    spent = sum(s.cost_inr for s in prefix)
    start = prefix[-1].departure_min if prefix else minutes(original.request.start_time)
    if request.completed_count == original.completed_count:
        start = max(start, original.progress_min)
    origin = prefix[-1].place_id if prefix else HUB.id
    result = _solve(original.request, origin, start + request.delay_minutes,
                    original.request.budget_inr - spent, {s.place_id for s in prefix},
                    original.request.max_stops - len(prefix))
    result.completed_count = request.completed_count
    if result.feasible:
        result.stops = prefix + result.stops
        result.total_cost_inr += spent
        result.total_travel_minutes += sum(s.travel_minutes for s in prefix)
    return _seal(result)
