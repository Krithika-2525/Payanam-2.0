from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.planning.main import app
from app.travel.api import current_actor
from app.travel.models import Actor


def test_no_key_search_uses_real_global_city_data():
    with TestClient(app) as c:
        caps=c.get('/api/v2/capabilities').json()
        assert caps['city_count']>30000
        assert caps['live_traffic'] is False
        r=c.get('/api/v2/places/search',params={'q':'Madurai','country':'IN'})
        assert r.status_code==200 and r.json()['places'][0]['provider']=='geonames'
        assert 'no-store' in r.headers['cache-control']
        assert c.get('/api/v2/places/search',params={'q':'x'}).status_code==422
        assert c.get('/api/v2/places/search',params={'q':'Paris','source':'places'}).status_code==503
        assert c.get('/api/v2/trips').status_code==401


def test_actual_database_private_api(monkeypatch,db,actors):
    import os
    monkeypatch.setenv('DATABASE_URL',os.environ['PAYANAM_TEST_DATABASE_URL'])
    current=[actors[0]]
    app.dependency_overrides[current_actor]=lambda:current[0]
    try:
        with TestClient(app) as c:
            place=c.get('/api/v2/places/search?q=Madurai&country=IN').json()['places'][0]
            payload={'title':'API journey','start_date':'2026-10-07','end_date':'2026-10-09','timezone':'Asia/Kolkata','currency':'INR'}
            r=c.post('/api/v2/trips',json=payload,headers={'Idempotency-Key':str(uuid4())})
            assert r.status_code==201
            trip=r.json();id=trip['id']
            assert r.headers['etag']=='"1"'
            r=c.patch('/api/v2/trips/'+id,json={'kind':'add_item','place_id':place['id'],'day_index':0},
                      headers={'Idempotency-Key':str(uuid4()),'If-Match':'"1"'})
            assert r.status_code==200 and len(r.json()['items'])==1
            assert c.patch('/api/v2/trips/'+id,json={'kind':'remove_item','item_id':r.json()['items'][0]['id']},
                           headers={'Idempotency-Key':str(uuid4()),'If-Match':'"1"'}).status_code==409
            export=c.get('/api/v2/trips/'+id+'/export')
            assert export.json()['version']==2
            current[0]=actors[1]
            for path in ['/api/v2/trips/'+id,'/api/v2/trips/'+id+'/export']:
                assert c.get(path).status_code==404
            current[0]=actors[0]
            assert c.delete('/api/v2/trips/'+id,headers={'If-Match':'"2"'}).status_code==204
            assert c.get('/api/v2/trips/'+id).status_code==404
    finally:
        app.dependency_overrides.clear()
