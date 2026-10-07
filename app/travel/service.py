from datetime import datetime, timezone
import hashlib
import json
import threading
import time

import httpx
from starlette.concurrency import run_in_threadpool
from sqlalchemy.exc import SQLAlchemyError

from .auth import IdentityVerifier
from .config import Settings
from .db import Database
from .errors import TravelError
from .models import ResolvedPlace
from .providers.cities import CityProvider
from .providers.geoapify import GeoapifyProvider
from .repository import TripRepository


class TravelServices:
    def __init__(self,settings: Settings):
        self.settings=settings
        self.cities=CityProvider()
        self.db,self.repo=None,None
        self.db_lock=threading.Lock()
        self.reconnect_at=0
        self.connect_database()
        self.identity=IdentityVerifier(settings.auth_issuer,settings.auth_audience)
        self.http=httpx.AsyncClient(timeout=5,follow_redirects=False)
        self.geoapify=GeoapifyProvider(settings.geoapify_key,self.http)

    def repository(self):
        if self.repo is None:self.connect_database()
        if self.repo is None:
            raise TravelError('database_not_configured','Cloud saves are being connected. Your local draft remains on this device.',503)
        return self.repo

    def connect_database(self):
        if not self.settings.database_url:return
        with self.db_lock:
            if self.repo or time.monotonic()<self.reconnect_at:return
            self.reconnect_at=time.monotonic()+30
            try:
                self.db=Database(self.settings.database_url)
                self.repo=TripRepository(self.db)
            except SQLAlchemyError:
                self.db,self.repo=None,None

    def capabilities(self):
        return {'billing_mode':'free_only','city_search':True,'city_count':len(self.cities.rows),
                'city_snapshot_at':self.cities.document['retrieved_at'],
                'place_search':bool(self.repo and self.settings.geoapify_key and self.settings.geoapify_zero_billing_confirmed),
                'cloud_trips':bool(self.repo and self.settings.auth_issuer),
                'map_style':'https://tiles.openfreemap.org/styles/liberty',
                'supabase_url':self.settings.supabase_url,'supabase_publishable_key':self.settings.supabase_publishable_key,
                'live_traffic':False,'live_transport':False,
                'attributions':['GeoNames · CC BY 4.0','OpenMapTiles · © OpenStreetMap contributors'],
                'message':'City results are a real GeoNames snapshot. Venue hours, prices and transport availability are not provided.'}

    async def search(self,query,source,bucket):
        cached=False
        if source=='cities':
            places=await run_in_threadpool(self.cities.search,query)
        else:
            if not self.capabilities()['place_search']:
                raise TravelError('place_search_not_configured','Detailed place search will be available when the free provider is connected. City search is ready.',503)
            repo=self.repository()
            key=hashlib.sha256(('geoapify|'+query.model_dump_json()).encode()).hexdigest()
            cached_data=await run_in_threadpool(repo.cache_get,key)
            if cached_data is not None:
                cached=True
                places=[ResolvedPlace.model_validate(p) for p in cached_data]
            else:
                now=datetime.now(timezone.utc)
                await run_in_threadpool(repo.reserve_credits,'client:'+bucket+':'+now.strftime('%Y%m%d%H%M'),1,30)
                # One geocoding call costs one credit; no automatic network retry.
                # Rolling two-day admission is conservative across unknown reset timezones.
                await run_in_threadpool(repo.reserve_credits,'geoapify:'+now.strftime('%Y%m%d'),1,self.settings.daily_credits//2)
                places=await self.geoapify.search(query)
                await run_in_threadpool(repo.cache_put,key,[p.model_dump(mode='json') for p in places])
        if self.repo:
            try:await run_in_threadpool(self.repo.store_places,places)
            except SQLAlchemyError:
                if source!='cities':raise
        return places,cached

    def resolve(self,id):
        city=self.cities.resolve(id)
        if city:return city
        return self.repo.place(id) if self.repo else None

    async def close(self):
        self.identity.close()
        await self.http.aclose()
        if self.db:self.db.close()
