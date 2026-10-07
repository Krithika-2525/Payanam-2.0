import os
from uuid import uuid4

import pytest

from app.travel.models import Actor, TripCreate
from app.travel.db import Database
from app.travel.repository import TripRepository


@pytest.fixture
def db():
    url=os.getenv('PAYANAM_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Set PAYANAM_TEST_DATABASE_URL to a migrated disposable Postgres/PostGIS database.')
    value=Database(url)
    yield value
    value.close()


@pytest.fixture
def actors():
    return [Actor(id=uuid4(),issuer='https://identity.test',subject=str(uuid4())) for _ in range(2)]


@pytest.fixture
def repo(db):
    return TripRepository(db)


@pytest.fixture
def trip_data():
    return TripCreate(title='India family trip',start_date='2026-10-07',end_date='2026-10-09',timezone='Asia/Kolkata',currency='INR')
