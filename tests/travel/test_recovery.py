import pytest
from sqlalchemy.exc import OperationalError
from app.travel.config import Settings
from app.travel.models import PlaceQuery
from app.travel.service import TravelServices


@pytest.mark.asyncio
async def test_city_discovery_survives_database_startup_outage():
    value=TravelServices(Settings(database_url='postgresql+psycopg://unavailable:local@127.0.0.1:1/missing'))
    try:
        result,_=await value.search(PlaceQuery(q='Madurai'), 'cities','local')
        assert result[0].name=='Madurai'
    finally:await value.close()


@pytest.mark.asyncio
async def test_city_search_survives_failed_snapshot_persistence():
    value=TravelServices(Settings())
    class Unavailable:
        def store_places(self,rows):raise OperationalError('test',{},Exception('unavailable'))
    value.repo=Unavailable()
    try:
        result,_=await value.search(PlaceQuery(q='Paris'), 'cities','local')
        assert result[0].country_code=='FR'
    finally:await value.close()
