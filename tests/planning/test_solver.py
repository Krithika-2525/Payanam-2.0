from datetime import date

import pytest
from pydantic import ValidationError

from app.planning.catalog import PLACES
from app.planning.models import PlanRequest, ReplanRequest
from app.planning.solver import replan, solve_plan


def request(**changes):
    return PlanRequest(**{'date': date(2026, 10, 12), 'start_time': '08:00', 'end_time': '19:00',
        'budget_inr': 3500, 'party_size': 3, 'required_place_ids': ['meenakshi', 'palace'],
        'optional_place_ids': ['gandhi', 'teppakulam'], 'pace': 'relaxed', **changes})


def test_required_visits_fit_sessions_and_budget():
    plan = solve_plan(request())
    assert plan.feasible
    assert {'meenakshi', 'palace'} <= {s.place_id for s in plan.stops}
    assert plan.total_cost_inr <= 3500
    assert plan.finish_min <= 19 * 60
    for stop in plan.stops:
        assert any(a <= stop.arrival_min and stop.departure_min <= b for a, b in PLACES[stop.place_id].windows)
    for previous, following in zip(plan.stops, plan.stops[1:]):
        assert following.arrival_min >= previous.departure_min + following.travel_minutes


def test_optional_session_stop_can_be_skipped():
    plan = solve_plan(request(start_time='13:00', end_time='15:30', pace='standard',
        required_place_ids=['palace'], optional_place_ids=['meenakshi']))
    assert plan.feasible
    assert [s.place_id for s in plan.stops] == ['palace']
    assert plan.skipped_place_ids == ['meenakshi']


def test_dwell_cannot_cross_closing():
    plan = solve_plan(request(start_time='16:50', end_time='19:00',
        required_place_ids=['palace'], optional_place_ids=[]))
    assert not plan.feasible
    assert plan.suggestions


def test_impossible_budget_is_infeasible():
    plan = solve_plan(request(budget_inr=1, required_place_ids=['alagar'], optional_place_ids=[]))
    assert not plan.feasible


def test_group_budget_counts_every_bus_passenger():
    one = solve_plan(request(party_size=1, transport='bus', required_place_ids=['alagar'], optional_place_ids=[]))
    four = solve_plan(request(party_size=4, transport='bus', required_place_ids=['alagar'], optional_place_ids=[]))
    assert four.total_cost_inr == one.total_cost_inr * 4


def test_relaxed_pace_has_more_rest():
    fast = solve_plan(request(pace='standard', optional_place_ids=[]))
    slow = solve_plan(request(pace='relaxed', optional_place_ids=[]))
    assert sum(s.rest_minutes for s in slow.stops) > sum(s.rest_minutes for s in fast.stops)


def test_replan_preserves_completed_prefix():
    plan = solve_plan(request())
    new = replan(ReplanRequest(original_plan=plan, completed_count=1, delay_minutes=45))
    assert new.feasible
    assert new.stops[0] == plan.stops[0]
    assert new.stops[1].arrival_min >= plan.stops[0].departure_min + 45 + new.stops[1].travel_minutes
    assert len({s.place_id for s in new.stops}) == len(new.stops)
    assert new.total_cost_inr <= plan.request.budget_inr


def test_replan_rejects_fabricated_completed_cost():
    plan = solve_plan(request())
    plan.stops[0].cost_inr = -1000
    with pytest.raises(ValueError, match='original plan'):
        replan(ReplanRequest(original_plan=plan, completed_count=1, delay_minutes=45))


@pytest.mark.parametrize('changes', [
    {'required_place_ids': ['unsupported']}, {'start_time': '25:00'},
    {'start_time': '19:00', 'end_time': '08:00'}, {'party_size': 21},
    {'required_place_ids': ['palace', 'palace']},
])
def test_request_rejects_invalid_preferences(changes):
    with pytest.raises(ValidationError):
        request(**changes)


def test_replan_cannot_decrease_completed_progress():
    original = solve_plan(request())
    first = replan(ReplanRequest(original_plan=original, completed_count=2, delay_minutes=45))
    assert first.completed_count == 2
    with pytest.raises(ValueError, match='completed'):
        replan(ReplanRequest(original_plan=first, completed_count=1, delay_minutes=45))


def test_successive_delays_accumulate_at_same_progress():
    original = solve_plan(request(optional_place_ids=[]))
    first = replan(ReplanRequest(original_plan=original, completed_count=1, delay_minutes=45))
    second = replan(ReplanRequest(original_plan=first, completed_count=1, delay_minutes=45))
    assert second.stops[0] == original.stops[0]
    assert second.stops[1].arrival_min >= first.stops[1].arrival_min + 45
    assert second.progress_min == first.progress_min + 45
