from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError


def test_database_rejects_cross_owner_and_pool_context_leak(db,repo,actors,trip_data):
    a,b=actors;trip=repo.create(a,trip_data,str(uuid4()))
    with db.transaction(b) as c:
        assert c.execute(text('select id from travel.trips where id=:id'),{'id':trip.id}).all()==[]
        with pytest.raises(DBAPIError):
            c.execute(text('insert into travel.trip_items(id,trip_id,day_index,position,place) values(:id,:trip,0,0,cast(:place as jsonb))'),
                      {'id':uuid4(),'trip':trip.id,'place':'{}'})
    with db.transaction(a) as c:
        assert c.execute(text('select owner_id from travel.trips where id=:id'),{'id':trip.id}).scalar()==a.id
    with db.engine.connect() as c:
        assert c.execute(text('select id from travel.trips')).all()==[]


def test_owner_transfer_is_rejected_by_database(db,repo,actors,trip_data):
    a,b=actors;repo.ensure_actor(b);trip=repo.create(a,trip_data,str(uuid4()))
    with pytest.raises(DBAPIError):
        with db.transaction(a) as c:
            c.execute(text('update travel.trips set owner_id=:owner where id=:id'),{'owner':b.id,'id':trip.id})


def test_deactivated_actor_is_rejected(repo,db,actors,trip_data):
    a=actors[0];repo.create(a,trip_data,str(uuid4()))
    with db.transaction(a) as c:
        c.execute(text('update travel.users set deactivated_at=now() where id=:id'),{'id':a.id})
    with pytest.raises(Exception):repo.list(a)


def test_delete_account_data_removes_trips_and_revokes_future_access(repo,actors,trip_data):
    from app.travel.errors import TravelError
    trip=repo.create(actors[0],trip_data,str(uuid4()))
    repo.delete_account_data(actors[0])
    with pytest.raises(TravelError):repo.get(actors[0],trip.id)
    with pytest.raises(TravelError):repo.create(actors[0],trip_data,str(uuid4()))


def test_concurrent_create_cannot_outlive_account_deletion(repo,db,actors,trip_data,monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from app.travel.repository import TripRepository
    admitted,release=Event(),Event();original=repo._actor
    repo.ensure_actor(actors[0])
    def pause(c,actor):
        original(c,actor);admitted.set();assert release.wait(5)
    monkeypatch.setattr(repo,'_actor',pause)
    other=TripRepository(db)
    with ThreadPoolExecutor(max_workers=2) as executor:
        create=executor.submit(repo.create,actors[0],trip_data,str(uuid4()))
        assert admitted.wait(5)
        deleting=executor.submit(other.delete_account_data,actors[0])
        # On unfixed code deletion completes while admission is still paused.
        try:deleting.result(timeout=.2)
        except TimeoutError:pass
        release.set();create.result(timeout=5);deleting.result(timeout=5)
    with db.transaction(actors[0]) as c:
        assert c.execute(text('select count(*) from travel.trips')).scalar()==0
