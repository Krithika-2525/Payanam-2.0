from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.travel.models import PlaceQuery, ResolvedPlace, TripCreate, TripChange


def test_native_script_query_preserved():
    assert PlaceQuery(q='மதுரை').q == 'மதுரை'
    assert PlaceQuery(q='नई दिल्ली', country='IN').country == 'IN'
    with pytest.raises(ValidationError):
        PlaceQuery(q='a')
    with pytest.raises(ValidationError):
        PlaceQuery(q='Paris', limit=11)


@pytest.mark.parametrize('longitude,latitude', [(float('nan'),9), (78,float('inf')), (181,9), (78,91)])
def test_coordinates_reject_nonfinite(longitude, latitude):
    with pytest.raises(ValidationError):
        ResolvedPlace(id=uuid4(),provider='geoapify',source_id='abc',name='Madurai',
                      longitude=longitude,latitude=latitude,retrieved_at=datetime.now(timezone.utc))


def test_trip_date_and_day_limits():
    assert TripCreate(title='Family journey',start_date=date(2026,10,7),end_date=date(2026,10,9),
                      timezone='Asia/Kolkata',currency='INR').title == 'Family journey'
    for fields in [dict(end_date='2026-10-06'),dict(end_date='2026-12-01'),
                   dict(timezone='Mars/City'),dict(currency='XYZ'),dict(title=' ')]:
        values=dict(title='Trip',start_date='2026-10-07',end_date='2026-10-09',timezone='Asia/Kolkata',currency='INR')
        with pytest.raises(ValidationError):
            TripCreate(**(values|fields))


def test_metadata_rejects_forged_owner():
    with pytest.raises(ValidationError):
        TripCreate(title='Trip',start_date='2026-10-07',end_date='2026-10-08',owner_id=str(uuid4()))


def test_only_known_change_kinds():
    assert TripChange.model_validate({'kind':'add_item','place_id':str(uuid4()),'day_index':0}).kind == 'add_item'
    for change in [{'kind':'admin','owner_id':str(uuid4())}, {'kind':'add_item','place_id':str(uuid4()),'day_index':-1},
                   {'kind':'update_item','item_id':str(uuid4()),'notes':'x'*4001}]:
        with pytest.raises(ValidationError):
            TripChange.model_validate(change)
