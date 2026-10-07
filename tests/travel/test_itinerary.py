from datetime import date
from uuid import uuid4

import pytest
from app.travel.models import PlaceQuery
from app.travel.providers.cities import CityProvider
from app.travel.providers.hotspots import HotspotProvider
from app.travel.itinerary_models import ItineraryRequest
from app.travel.itinerary import generate_itinerary, opening_windows
import httpx


def real_inputs():
    city=CityProvider().search(PlaceQuery(q='Madurai',country='IN'))[0]
    return city,HotspotProvider(httpx.AsyncClient()).snapshot(city).places


def test_real_city_generates_unique_bounded_visits_with_return_and_break():
    city,places=real_inputs()
    request=ItineraryRequest(city_id=city.id,start_date='2026-10-09',days=3,interests=['heritage','temple'],mode='drive')
    plan=generate_itinerary(request,city,places)
    stops=[s for day in plan.days for s in day.stops]
    assert len(stops)>=4
    assert len({s.place.id for s in stops})==len(stops)
    assert all(d.date==date(2026,10,9+i) for i,d in enumerate(plan.days))
    for day in plan.days:
        assert day.return_at<='18:00'
        assert all(s.arrival<s.departure<='18:00' for s in day.stops)
        assert all(s.departure<='13:00' or s.arrival>='14:00' for s in day.stops)
        assert all(s.travel_minutes>=0 and s.travel_source=='estimate' for s in day.stops)
    assert plan.city.id==city.id and any('estimate' in w.lower() for w in plan.warnings)


def test_closed_hours_exclude_stop_and_explain_unfulfilled_required():
    city,places=real_inputs()
    closed=places[0].model_copy(update={'opening_hours':'Mo-Fr 09:00-17:00; Sa-Su off'})
    r=ItineraryRequest(city_id=city.id,start_date='2026-10-10',days=1,must_visit=[closed.id])
    p=generate_itinerary(r,city,[closed])
    assert not p.days[0].stops
    assert any(closed.name in w for w in p.warnings)


def test_weekly_windows_unknown_syntax_and_split_hours_are_conservative():
    assert opening_windows('Mo-Fr 09:00-12:00,14:00-17:00; Sa-Su off',date(2026,10,9))==([(540,720),(840,1020)],'mapped')
    assert opening_windows('Mo-Fr 09:00-17:00; Sa-Su off',date(2026,10,10))==([],'closed')
    assert opening_windows('sunrise-sunset; PH off',date(2026,10,10))[1]=='unverified'
    assert opening_windows(None,date(2026,10,10))[1]=='unknown'


def test_constraints_no_invented_places_and_unreachable_required_report():
    city,places=real_inputs()
    unknown=uuid4()
    r=ItineraryRequest(city_id=city.id,start_date='2026-10-09',days=1,must_visit=[unknown],exclude=[p.id for p in places])
    p=generate_itinerary(r,city,places)
    assert not p.days[0].stops and p.warnings
    with pytest.raises(ValueError):ItineraryRequest(city_id=city.id,start_date='2026-10-09',days=15)
    with pytest.raises(ValueError):ItineraryRequest(city_id=city.id,start_date='2026-10-09',day_start='18:00',day_end='09:00')


def test_public_backend_generates_actual_hotspots_without_sign_in():
    from fastapi.testclient import TestClient
    from app.planning.main import app
    with TestClient(app) as c:
        city=c.get('/api/v2/places/search?q=Madurai&country=IN').json()['places'][0]
        r=c.get('/api/v2/cities/'+city['id']+'/hotspots')
        assert r.status_code==200 and len(r.json()['places'])>=5
        result=c.post('/api/v2/itineraries/generate',json={'city_id':city['id'],'start_date':'2026-10-09','days':2})
        assert result.status_code==200 and result.json()['days'][0]['stops']
        assert c.post('/api/v2/itineraries/generate',json={'city_id':str(uuid4()),'start_date':'2026-10-09'}).status_code==404
        route=c.post('/api/v2/itineraries/route',json={'city_id':city['id'],'place_ids':[],'mode':'walk'})
        assert route.status_code==200 and route.json()['available'] is False


@pytest.mark.asyncio
async def test_forecast_has_real_dates_units_and_unavailable_state():
    from app.travel.providers.weather import WeatherProvider
    city,_=real_inputs()
    async def transport(request):
        assert request.url.host=='api.open-meteo.com'
        return httpx.Response(200,json={'daily':{'time':['2026-10-09'],'weather_code':[3],'temperature_2m_max':[29.5],'temperature_2m_min':[22.0],'precipitation_probability_max':[30]}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        result=await WeatherProvider(client).forecast(city)
        assert result['days'][0]['date']=='2026-10-09' and result['days'][0]['rain_probability']==30
        assert result['units']['temperature']=='°C' and result['source']=='Open-Meteo'
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r:httpx.Response(503))) as client:
        assert (await WeatherProvider(client).forecast(city))['available'] is False


def test_recalculate_keeps_each_chosen_day_and_manual_order():
    city,places=real_inputs()
    chosen=places[:3]
    request=ItineraryRequest(city_id=city.id,start_date='2026-10-09',days=2,
        fixed_order=[[chosen[1].id,chosen[0].id],[chosen[2].id]])
    result=generate_itinerary(request,city,places)
    assert [s.place.id for s in result.days[0].stops]==[chosen[1].id,chosen[0].id]
    assert [s.place.id for s in result.days[1].stops]==[chosen[2].id]


def test_public_generation_survives_private_database_write_outage(monkeypatch,db):
    import os
    from fastapi.testclient import TestClient
    from app.planning.main import app
    from sqlalchemy.exc import SQLAlchemyError
    monkeypatch.setenv('DATABASE_URL',os.environ['PAYANAM_TEST_DATABASE_URL'])
    with TestClient(app) as c:
        def fail(places):raise SQLAlchemyError('temporary database outage')
        monkeypatch.setattr(app.state.travel.repo,'store_places',fail)
        city=real_inputs()[0]
        r=c.post('/api/v2/itineraries/generate',json={'city_id':str(city.id),'start_date':'2026-10-09','days':1})
        assert r.status_code==200 and r.json()['days'][0]['stops']


def test_later_weekday_closure_overrides_normal_weekly_opening():
    assert opening_windows('Mo-Su 09:00-17:00; We off',date(2026,10,7))==([],'closed')


@pytest.mark.parametrize('name,country,source',[('Paris','FR','openstreetmap'),('Tokyo','JP','wikipedia'),('London','GB','openstreetmap')])
def test_real_international_snapshots_generate_source_attributed_days(name,country,source):
    city=CityProvider().search(PlaceQuery(q=name,country=country))[0]
    snapshot=HotspotProvider(httpx.AsyncClient()).snapshot(city)
    assert len(snapshot.places)>=5 and snapshot.source==source
    plan=generate_itinerary(ItineraryRequest(city_id=city.id,start_date='2026-10-10',days=2),city,snapshot.places)
    assert plan.days[0].stops and plan.city.timezone==city.timezone
    assert all(s.place.provider==source and s.place.source_url for d in plan.days for s in d.stops)


@pytest.mark.parametrize('fixed',[False,True])
def test_reserved_lunch_leaves_time_for_travel_and_return(fixed):
    from app.travel.itinerary import minutes
    city,places=real_inputs()
    request=ItineraryRequest(city_id=city.id,start_date='2026-10-09',days=3,pace='packed',mode='walk')
    if fixed:
        initial=generate_itinerary(request,city,places)
        request=request.model_copy(update={'fixed_order':[[s.place.id for s in d.stops] for d in initial.days]})
    plan=generate_itinerary(request,city,places)
    for day in plan.days:
        previous=minutes(request.day_start)
        for stop in day.stops:
            arrival=minutes(stop.arrival)
            required_break=60 if previous<840 and arrival>780 else 0
            assert arrival-previous >= stop.travel_minutes+required_break
            previous=minutes(stop.departure)
        if day.stops:
            returned=minutes(day.return_at)
            required_break=60 if previous<840 and returned>780 else 0
            assert returned-previous>=day.return_minutes+required_break


def test_recalculation_resolves_retained_source_outside_current_result(monkeypatch):
    from fastapi.testclient import TestClient
    from app.planning.main import app
    with TestClient(app) as client:
        city=app.state.travel.cities.search(PlaceQuery(q='Tokyo',country='JP'))[0]
        snapshot=app.state.travel.hotspots.snapshot(city)
        retained=snapshot.places[0]
        async def discovery(city):return snapshot.model_copy(update={'places':snapshot.places[1:]})
        monkeypatch.setattr(app.state.travel.hotspots,'discover',discovery)
        assert client.get('/api/v2/places/'+str(retained.id)).status_code==200
        result=client.post('/api/v2/itineraries/generate',json={'city_id':str(city.id),'start_date':'2026-10-09','days':1,'fixed_order':[[str(retained.id)]]})
        assert result.status_code==200
        assert result.json()['days'][0]['stops'][0]['place']['id']==str(retained.id)


def test_recalculation_supports_repeat_days_and_retains_relaxed_duration():
    city,places=real_inputs()
    p=places[0].model_copy(update={'opening_hours':None})
    request=ItineraryRequest(city_id=city.id,start_date='2026-10-09',days=2,pace='relaxed',fixed_order=[[p.id],[p.id]])
    plan=generate_itinerary(request,city,[p])
    assert all(d.stops[0].place.id==p.id and d.stops[0].duration_minutes==__import__('math').ceil(p.recommended_duration_minutes*1.2) for d in plan.days)
