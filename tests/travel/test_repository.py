from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from sqlalchemy import text

from app.travel.models import TripChange
from app.travel.providers.cities import CityProvider
from app.travel.errors import TravelError


def test_persistent_owner_trip_and_idempotent_create(repo,actors,trip_data):
    a,b=actors
    key=str(uuid4())
    trip=repo.create(a,trip_data,key)
    assert repo.get(a,trip.id).title=='India family trip'
    assert repo.create(a,trip_data,key).id==trip.id
    assert len(repo.list(a))==1
    assert repo.list(b)==[]
    with pytest.raises(TravelError) as error:repo.get(b,trip.id)
    assert error.value.status==404
    changed=trip_data.model_copy(update={'title':'Other'})
    with pytest.raises(TravelError):repo.create(a,changed,key)


def test_actual_place_snapshot_edit_conflict_and_delete(repo,db,actors,trip_data):
    a,b=actors
    city=CityProvider().search(__import__('app.travel.models',fromlist=['PlaceQuery']).PlaceQuery(q='Madurai',country='IN'))[0]
    repo.store_places([city])
    trip=repo.create(a,trip_data,str(uuid4()))
    change=TripChange(kind='add_item',place_id=city.id,day_index=0)
    key=str(uuid4())
    updated=repo.revise(a,trip.id,trip.version,change,key)
    assert updated.items[0].place.name=='Madurai' and updated.version==2
    assert repo.revise(a,trip.id,trip.version,change,key).version==2
    with pytest.raises(TravelError) as error:repo.revise(a,trip.id,1,change,str(uuid4()))
    assert error.value.status==409
    with pytest.raises(TravelError):repo.revise(b,trip.id,2,change,str(uuid4()))
    with pytest.raises(TravelError):repo.revise(a,trip.id,2,TripChange(kind='move_item',item_id=updated.items[0].id,day_index=9),str(uuid4()))
    repo.delete(a,trip.id,updated.version)
    with pytest.raises(TravelError):repo.get(a,trip.id)
    with db.transaction(a) as c:
        assert c.execute(text('select count(*) from travel.trip_items where trip_id=:id'),{'id':trip.id}).scalar()==0


def test_concurrent_edits_one_wins(repo,actors,trip_data):
    a=actors[0];trip=repo.create(a,trip_data,str(uuid4()))
    def update(title):
        try:
            return repo.revise(a,trip.id,1,TripChange(kind='update_metadata',metadata=trip_data.model_copy(update={'title':title})),str(uuid4())).version
        except TravelError as e:return e.status
    with ThreadPoolExecutor(2) as pool:results=list(pool.map(update,['First','Second']))
    assert sorted(results)==[2,409]


def test_credit_cap_is_atomic_across_connections(repo):
    bucket=str(uuid4())
    def reserve(_):
        try:repo.reserve_credits(bucket,1,3);return True
        except TravelError:return False
    with ThreadPoolExecutor(4) as pool:results=list(pool.map(reserve,range(6)))
    assert sum(results)==3


def test_removal_then_append_keeps_distinct_contiguous_positions(repo,actors,trip_data):
    from app.travel.models import PlaceQuery
    city=CityProvider().search(PlaceQuery(q='Madurai'))[0];repo.store_places([city])
    trip=repo.create(actors[0],trip_data,str(uuid4()))
    for _ in range(3):trip=repo.revise(actors[0],trip.id,trip.version,TripChange(kind='add_item',place_id=city.id,day_index=0),str(uuid4()))
    trip=repo.revise(actors[0],trip.id,trip.version,TripChange(kind='remove_item',item_id=trip.items[0].id),str(uuid4()))
    trip=repo.revise(actors[0],trip.id,trip.version,TripChange(kind='add_item',place_id=city.id,day_index=0),str(uuid4()))
    assert [item.position for item in trip.items]==[0,1,2]
