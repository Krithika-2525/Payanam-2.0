from datetime import datetime,timezone
import httpx
import pytest
from app.travel.models import PlaceQuery
from app.travel.providers.cities import CityProvider
from app.travel.providers.wikipedia import WikipediaProvider,decode_pages


def test_only_qualified_nearby_places_become_attractions_not_events():
    city=CityProvider().search(PlaceQuery(q='Tokyo',country='JP'))[0]
    raw={'query':{'pages':{
        '1':{'pageid':1,'title':'A real art museum','coordinates':[{'lat':city.latitude,'lon':city.longitude}], 'categories':[{'title':'Category:Art museums and galleries in Tokyo'}]},
        '2':{'pageid':2,'title':'A station attack','coordinates':[{'lat':city.latitude,'lon':city.longitude}], 'categories':[{'title':'Category:Terrorist incidents in Japan'}]},
        '3':{'pageid':3,'title':'Tokyo district','coordinates':[{'lat':city.latitude,'lon':city.longitude}], 'categories':[{'title':'Category:Districts of Tokyo'}]}}}}
    places=decode_pages(raw,city,datetime.now(timezone.utc))
    assert len(places)==1 and places[0].category=='museum'
    assert places[0].source_id=='1' and places[0].provider=='wikipedia'
    assert places[0].license=='CC-BY-SA-4.0' and places[0].opening_hours is None


@pytest.mark.asyncio
async def test_fallback_data_is_attributed_and_bounded():
    city=CityProvider().search(PlaceQuery(q='Tokyo',country='JP'))[0]
    async def transport(r):
        assert r.url.host=='en.wikipedia.org'
        return httpx.Response(200,json={'query':{'pages':{'1':{'pageid':1,'title':'Art Museum','coordinates':[{'lat':city.latitude,'lon':city.longitude}], 'categories':[{'title':'Category:Museums in Tokyo'}]}}}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        places=await WikipediaProvider(client).discover(city)
        assert len(places)==1 and places[0].attribution.startswith('Wikipedia')


@pytest.mark.asyncio
async def test_unknown_city_uses_independent_wikipedia_source_when_osm_is_down():
    from app.travel.providers.hotspots import HotspotProvider
    city=CityProvider().search(PlaceQuery(q='Kyoto',country='JP'))[0]
    async def transport(r):
        if r.method=='POST':return httpx.Response(503)
        return httpx.Response(200,json={'query':{'pages':{'1':{'pageid':1,'title':'A Kyoto temple','coordinates':[{'lat':city.latitude,'lon':city.longitude}], 'categories':[{'title':'Category:Buddhist temples in Kyoto'}]}}}})
    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        provider=HotspotProvider(client)
        result=await provider.discover(city)
        assert result.source=='wikipedia' and result.places[0].provider=='wikipedia'
        assert 'Wikipedia' in result.message and 'hours' in result.message
