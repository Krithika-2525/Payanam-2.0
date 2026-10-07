import json
from uuid import uuid4
import pytest
from app.planning.models import PlanRequest
from app.planning.solver import solve_plan
from app.travel.legacy import decode_legacy
from app.travel.errors import TravelError


def envelope():
    plan=solve_plan(PlanRequest(date="2026-10-07")).model_dump(mode='json')
    return {'kind':'payanam-journey','version':1,'plan':plan}


def test_signature_evidence_never_turns_illustrative_facts_real():
    value=envelope();original=json.dumps(value)
    for signature in [value['plan']['signature'],'wrong','']:
        value['plan']['signature']=signature
        result=decode_legacy(json.dumps(value))
        assert all(p.provider=='legacy-illustrative' and p.observed_at is None for p in result.places)
        assert result.original==json.dumps(value)
        assert result.verified==(signature not in ('wrong',''))
    assert json.loads(original)['plan']['signature']


@pytest.mark.parametrize('raw',['x'*65537,json.dumps({'kind':'payanam-journey','version':2,'plan':{}}),'<script>bad</script>'])
def test_invalid_legacy_is_rejected(raw):
    with pytest.raises(TravelError):decode_legacy(raw)


def test_legacy_import_is_atomic_private_and_deduplicated(repo,actors):
    raw=json.dumps(envelope());data=decode_legacy(raw)
    trip=repo.import_legacy(actors[0],data,str(uuid4()))
    duplicate=repo.import_legacy(actors[0],data,str(uuid4()))
    assert duplicate.id==trip.id and trip.origin.startswith('legacy-illustrative')
    assert len(trip.items)==len(data.places)
    with pytest.raises(TravelError):repo.get(actors[1],trip.id)
    repo.delete(actors[0],trip.id,trip.version)
