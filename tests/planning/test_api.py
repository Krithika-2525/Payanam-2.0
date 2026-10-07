import threading
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from app.planning.main import app

BODY = {'date': '2026-10-12', 'required_place_ids': ['meenakshi', 'palace'],
        'optional_place_ids': ['gandhi'], 'budget_inr': 3000}


def test_real_plan_and_catalog():
    with TestClient(app) as client:
        assert client.get('/health').json()['status'] == 'ok'
        assert len(client.get('/api/v1/catalog').json()['places']) == 6
        response = client.post('/api/v1/plans/preview', json=BODY)
        assert response.status_code == 200
        assert response.json()['feasible']
        plan = response.json()
        changed = client.post('/api/v1/plans/replan', json={'original_plan': plan, 'completed_count': 1, 'delay_minutes': 30})
        assert changed.status_code == 200
        assert changed.json()['stops'][0] == plan['stops'][0]


def test_invalid_infeasible_and_legacy_isolation():
    with TestClient(app) as client:
        assert client.post('/api/v1/plans/preview', json={**BODY, 'party_size': 0}).status_code == 422
        response = client.post('/api/v1/plans/preview', json={**BODY, 'budget_inr': 1, 'required_place_ids': ['alagar']})
        assert response.status_code == 200
        assert not response.json()['feasible']
        assert client.post('/api/v1/driver/location', json={}).status_code == 404
        assert client.post('/api/v1/route', json={}).status_code == 404


def test_cors_only_allows_configured_origins():
    with TestClient(app) as client:
        allowed = client.options('/api/v1/plans/preview', headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST'})
        assert allowed.headers['access-control-allow-origin'] == 'http://localhost:5173'
        denied = client.options('/api/v1/plans/preview', headers={'Origin': 'https://untrusted.example', 'Access-Control-Request-Method': 'POST'})
        assert 'access-control-allow-origin' not in denied.headers


def test_oversized_body_rejected():
    with TestClient(app) as client:
        assert client.post('/api/v1/plans/preview', content=' ' * 70000).status_code == 413


def test_tampered_replan_returns_useful_error():
    with TestClient(app) as client:
        plan = client.post('/api/v1/plans/preview', json=BODY).json()
        plan['total_cost_inr'] = -1
        response = client.post('/api/v1/plans/replan', json={'original_plan': plan, 'completed_count': 1, 'delay_minutes': 30})
        assert response.status_code == 422
        assert 'original plan' in response.json()['detail']


def test_solver_overload_is_rejected_without_extra_work(monkeypatch):
    import app.planning.main as service
    entered = threading.Barrier(3)
    release = threading.Event()
    real_solver = service.solve_plan

    def held_solver(request):
        entered.wait(timeout=3)
        release.wait(timeout=3)
        return real_solver(request)

    monkeypatch.setattr(service, 'solve_plan', held_solver)
    with TestClient(app) as client, ThreadPoolExecutor(max_workers=2) as callers:
        futures = [callers.submit(client.post, '/api/v1/plans/preview', json=BODY) for _ in range(2)]
        entered.wait(timeout=3)
        try:
            assert client.post('/api/v1/plans/preview', json=BODY).status_code == 503
        finally:
            release.set()
        assert all(f.result().status_code == 200 for f in futures)
