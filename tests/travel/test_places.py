from datetime import datetime, timezone
from uuid import uuid5, NAMESPACE_URL

import httpx
import pytest

from app.travel.models import PlaceQuery
from app.travel.providers.cities import CityProvider
from app.travel.providers.geoapify import GeoapifyProvider
from app.travel.errors import TravelError


def test_real_city_snapshot_india_and_international():
    provider = CityProvider()
    for query, country in [('Madurai','IN'),('Chennai','IN'),('Paris','FR'),('Tokyo','JP')]:
        result = provider.search(PlaceQuery(q=query,country=country))
        assert result and result[0].country_code == country
        assert result[0].provider == 'geonames'
        assert result[0].license == 'CC-BY-4.0'
        assert result[0].observed_at is None
        assert result[0].source_url.startswith('https://www.geonames.org/')
        assert -180 <= result[0].longitude <= 180
    assert provider.search(PlaceQuery(q='unfindablecityxyz')) == []


def test_real_native_script_and_country_disambiguation():
    p = CityProvider()
    assert any(x.country_code == 'IN' for x in p.search(PlaceQuery(q='மதுரை')))
    france = p.search(PlaceQuery(q='Paris',country='FR'))[0]
    texas = p.search(PlaceQuery(q='Paris',country='US'))[0]
    assert france.id != texas.id
    assert p.resolve(france.id) == france


@pytest.mark.asyncio
async def test_geoapify_keeps_real_identity_and_missing_facts():
    transport = httpx.MockTransport(lambda req: httpx.Response(200,json={'features':[{
        'geometry':{'type':'Point','coordinates':[78.1,9.9]},
        'properties':{'place_id':'node-12','name':'மதுரை','country_code':'in','country':'India'}}]}))
    async with httpx.AsyncClient(transport=transport) as client:
        p = GeoapifyProvider('test-key',client)
        items = await p.search(PlaceQuery(q='மதுரை'))
    assert items[0].name == 'மதுரை'
    assert items[0].country_code == 'IN'
    assert items[0].timezone is None and items[0].observed_at is None
    assert items[0].id == uuid5(NAMESPACE_URL,'geoapify:node-12')
    assert 'hours' not in items[0].model_dump()


@pytest.mark.asyncio
@pytest.mark.parametrize('status,code',[(429,'provider_quota'),(500,'provider_unavailable'),(401,'provider_unavailable')])
async def test_geoapify_errors_never_return_demo_data(status,code):
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req:httpx.Response(status))) as c:
        with pytest.raises(TravelError) as e:
            await GeoapifyProvider('test',c).search(PlaceQuery(q='Paris'))
        assert e.value.code == code


@pytest.mark.asyncio
async def test_geoapify_rejects_malformed_coordinates():
    result={'features':[{'geometry':{'coordinates':[999,91]},'properties':{'place_id':'bad','name':'bad'}}]}
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda req:httpx.Response(200,json=result))) as c:
        with pytest.raises(TravelError):
            await GeoapifyProvider('test',c).search(PlaceQuery(q='Paris'))
