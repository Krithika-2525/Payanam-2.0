import asyncio
from datetime import datetime, timezone
from uuid import UUID

import httpx
import pytest

from app.travel.models import PlaceQuery
from app.travel.providers.cities import CityProvider
from app.travel.providers.hotspots import HotspotProvider, decode_elements


def madurai():
    return CityProvider().search(PlaceQuery(q='Madurai',country='IN'))[0]


def test_real_snapshot_has_nearby_attractions_and_attribution():
    provider = HotspotProvider(httpx.AsyncClient())
    result = asyncio.run(provider.discover(madurai()))
    assert len(result.places) >= 5
    assert any('Meenakshi' in p.name or 'Gandhi' in p.name for p in result.places)
    assert result.source == 'openstreetmap'
    assert all(p.provider == 'openstreetmap' and p.license == 'ODbL-1.0' for p in result.places)
    assert all(p.distance_m <= 8100 for p in result.places)
    assert all(provider.resolve(p.id) == p for p in result.places)


def test_decode_excludes_private_unnamed_and_duplicates_with_safe_urls():
    city = madurai()
    raw = {'elements':[
        {'type':'node','id':1,'lat':city.latitude,'lon':city.longitude,'tags':{'name':'Museum','tourism':'museum','opening_hours':'Tu-Su 09:00-17:00','website':'javascript:alert(1)'}},
        {'type':'way','id':2,'center':{'lat':city.latitude,'lon':city.longitude},'tags':{'name':'Museum','tourism':'museum'}},
        {'type':'node','id':3,'lat':city.latitude,'lon':city.longitude,'tags':{'name':'Private park','leisure':'park','access':'private'}},
        {'type':'node','id':4,'lat':city.latitude,'lon':city.longitude,'tags':{'tourism':'attraction'}},
    ]}
    places = decode_elements(raw,city,datetime.now(timezone.utc))
    assert len(places) == 1 and places[0].website is None
    assert places[0].opening_hours == 'Tu-Su 09:00-17:00'
    assert places[0].category == 'museum' and isinstance(places[0].id,UUID)


@pytest.mark.asyncio
async def test_provider_outage_retains_dated_snapshot_and_coalesces_requests():
    calls=[]
    async def unavailable(request):
        calls.append(request)
        await asyncio.sleep(.01)
        return httpx.Response(503)
    async with httpx.AsyncClient(transport=httpx.MockTransport(unavailable)) as client:
        provider=HotspotProvider(client)
        one,two=await asyncio.gather(provider.discover(madurai(),True),provider.discover(madurai(),True))
        assert calls and len(calls)==1
        assert one.places == two.places and one.stale
        assert 'snapshot' in one.message.lower()
        await provider.discover(madurai(),True)
        assert len(calls)==1


@pytest.mark.asyncio
async def test_cancelled_client_does_not_leave_discovery_slots_occupied():
    calls=[]
    async def delayed(request):
        await asyncio.sleep(.03)
        return httpx.Response(200,json={'elements':[]})
    async with httpx.AsyncClient(transport=httpx.MockTransport(delayed)) as client:
        provider=HotspotProvider(client)
        task=asyncio.create_task(provider.discover(madurai(),True))
        await asyncio.sleep(.005)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):await task
        await asyncio.sleep(.05)
        assert not provider.pending
