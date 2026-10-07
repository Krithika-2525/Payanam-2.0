"""Bounded OSM discovery for a noncommercial hackathon, with licensed snapshots."""
import asyncio
from collections import OrderedDict
from datetime import datetime, timezone
import gzip
import json
import math
from pathlib import Path
import time
from urllib.parse import urlparse, quote
from uuid import NAMESPACE_URL, uuid5

import httpx
from pydantic import Field
from ..models import StrictModel, ResolvedPlace
from ..errors import TravelError
from .wikipedia import WikipediaProvider

ENDPOINT = 'https://gall.openstreetmap.de/api/interpreter'  # Documented workaround for the failing round-robin host during this evaluation.
RADIUS = 8000


def distance(a, b):
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    h = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(math.radians(b.longitude-a.longitude)/2)**2
    return 6371000*2*math.asin(min(1, math.sqrt(h)))


def safe_url(value):
    try:
        p = urlparse(value or '')
        return value[:1000] if p.scheme in ('http','https') and p.netloc and not p.username and not p.password else None
    except ValueError:return None


def category(tags):
    if tags.get('tourism') in ('museum','gallery'):return 'museum'
    if tags.get('amenity') in ('restaurant','cafe','food_court'):return 'food'
    if tags.get('leisure') in ('park','garden') or tags.get('natural'):return 'nature'
    if tags.get('tourism') == 'viewpoint':return 'viewpoint'
    if tags.get('amenity') == 'place_of_worship':return 'temple'
    if tags.get('historic'):return 'heritage'
    return 'attraction'


def decode_elements(raw, city, retrieved_at):
    candidates=[]
    for e in raw.get('elements',[]):
        try:
            tags=e.get('tags',{})
            name=tags.get('name:en') or tags.get('name')
            if not name or tags.get('access') in ('private','no') or tags.get('disused')=='yes':continue
            center=e.get('center',e)
            kind=category(tags)
            wiki=tags.get('wikipedia')
            wikiurl=None
            if wiki and ':' in wiki:
                lang,title=wiki.split(':',1)
                if lang.isalpha() and len(lang)<=12:wikiurl='https://'+lang+'.wikipedia.org/wiki/'+quote(title.replace(' ','_'),safe='')
            p=ResolvedPlace(id=uuid5(NAMESPACE_URL,'openstreetmap:'+e['type']+'/'+str(e['id'])),
                provider='openstreetmap',source_id=e['type']+'/'+str(e['id']),name=name[:300],
                local_name=(tags.get('name') or '')[:300] or None,country=city.country,country_code=city.country_code,
                latitude=center['lat'],longitude=center['lon'],timezone=city.timezone,kind='hotspot',category=kind,
                retrieved_at=retrieved_at,source_url='https://www.openstreetmap.org/'+e['type']+'/'+str(e['id']),
                attribution='© OpenStreetMap contributors · ODbL 1.0',license='ODbL-1.0',
                opening_hours=(tags.get('opening_hours') or '')[:500] or None,
                website=safe_url(tags.get('website') or tags.get('contact:website')),wikipedia=wikiurl,
                wheelchair=(tags.get('wheelchair') or '')[:40] or None,fee=(tags.get('fee') or '')[:40] or None,
                address=', '.join(filter(None,[tags.get('addr:street'),tags.get('addr:city')]))[:500] or None,
                description=(tags.get('description:en') or tags.get('description') or '')[:1000] or None,
                recommended_duration_minutes={'museum':90,'food':60,'nature':45,'viewpoint':30}.get(kind,60))
            p.distance_m=round(distance(city,p))
            if p.distance_m>RADIUS+100:continue
            score=(30 if wiki else 0)+(20 if tags.get('wikidata') else 0)+(8 if kind in ('museum','heritage','attraction') else 0)-(5 if kind=='food' else 0)
            candidates.append((score,p))
        except (KeyError,ValueError,TypeError):continue
    candidates.sort(key=lambda v:(-v[0],v[1].distance_m,v[1].name))
    places=[]
    for _,p in candidates:
        if any(p.name.casefold()==x.name.casefold() and distance(p,x)<120 for x in places):continue
        places.append(p)
    return places[:100]


class HotspotResult(StrictModel):
    city: ResolvedPlace
    places: list[ResolvedPlace]
    source: str = 'openstreetmap'
    retrieved_at: datetime
    cached: bool = False
    stale: bool = False
    message: str


def query_for(city):
    delta=RADIUS/111000
    dx=delta/max(.15,math.cos(math.radians(city.latitude)))
    area=f'({city.latitude-delta:.5f},{city.longitude-dx:.5f},{city.latitude+delta:.5f},{city.longitude+dx:.5f})'
    selectors=['["tourism"~"^(attraction|museum|viewpoint|gallery)$"]',
               '["historic"~"^(castle|monument|memorial|ruins|archaeological_site|building)$"]',
               '["leisure"~"^(park|garden)$"]','["amenity"="place_of_worship"]["wikidata"]',
               '["amenity"~"^(restaurant|cafe|food_court)$"]["wikidata"]']
    return '[out:json][timeout:15][maxsize:67108864];('+''.join('nwr'+area+'["name"]'+s+';' for s in selectors)+');out center 500;'


class HotspotProvider:
    def __init__(self,client):
        self.client=client
        self.wikipedia=WikipediaProvider(client)
        self.cache=OrderedDict()
        self.pending={}
        self.cooldown={}
        self.gate=asyncio.Semaphore(2)
        path=Path(__file__).parent.parent/'data/hotspots.json.gz'
        self.snapshots={}
        if path.exists():
            with gzip.open(path,'rt',encoding='utf-8') as f:self.snapshots=json.load(f)['cities']

    def resolve(self,id):
        for result,_ in self.cache.values():
            for p in result.places:
                if p.id==id:return p
        for record in self.snapshots.values():
            for value in record['places']:
                if value['id']==str(id):return ResolvedPlace.model_validate(value)
        return None

    def snapshot(self,city):
        record=self.snapshots.get(str(city.id))
        if not record:return None
        return HotspotResult(city=city,places=[ResolvedPlace.model_validate(p) for p in record['places']],
            source=record.get('source','openstreetmap'),
            retrieved_at=record['retrieved_at'],cached=True,stale=True,
            message='Sourced city snapshot · choose Refresh places for a current retrieval. Hours and fees may be unknown; verify before travelling.')

    async def discover(self,city,refresh=False):
        key=str(city.id)
        hit=self.cache.get(key)
        if hit and (not refresh or time.monotonic()<self.cooldown.get(key,0)):
            self.cache.move_to_end(key)
            return hit[0].model_copy(update={'cached':True})
        snapshot=self.snapshot(city)
        if not refresh and snapshot:
            self.remember(key,snapshot)
            return snapshot
        if time.monotonic()<self.cooldown.get(key,0):
            if snapshot:return snapshot
            raise TravelError('discovery_busy','Place discovery is cooling down. Please retry in a minute.',429,True)
        if key in self.pending:return await asyncio.shield(self.pending[key])
        if len(self.pending)>=2:
            if snapshot:return snapshot
            raise TravelError('discovery_busy','Place discovery is busy. Please retry shortly.',429,True)
        task=asyncio.create_task(self.fetch(city,snapshot))
        self.pending[key]=task
        def finished(completed):
            self.pending.pop(key,None)
            # Retrieve a possible error even when the requesting client disconnected.
            if not completed.cancelled():completed.exception()
        task.add_done_callback(finished)
        try:return await asyncio.shield(task)
        finally:
            if task.done():self.pending.pop(key,None)

    def remember(self,key,result):
        self.cache[key]=(result,time.monotonic())
        self.cache.move_to_end(key)
        while len(self.cache)>128:self.cache.popitem(last=False)

    async def fetch(self,city,snapshot):
        key=str(city.id)
        self.cooldown[key]=time.monotonic()+60
        if len(self.cooldown)>256:self.cooldown.pop(next(iter(self.cooldown)))
        try:
            async with self.gate:
                response=await self.client.post(ENDPOINT,data={'data':query_for(city)},timeout=22,
                    headers={'User-Agent':'PayanamHackathon/1.0 (noncommercial evaluation)','Accept':'application/json'})
            response.raise_for_status()
            if len(response.content)>2_000_000:raise ValueError('Response too large')
            raw=response.json()
            if raw.get('remark'):raise ValueError('Partial provider response')
            now=datetime.now(timezone.utc)
            places=decode_elements(raw,city,now)
            result=HotspotResult(city=city,places=places,retrieved_at=now,message='Retrieved from OpenStreetMap · community hours and fees need confirmation. No invented ratings or ticket prices.')
        except (httpx.HTTPError,ValueError,TypeError):
            if snapshot:
                result=snapshot.model_copy(update={'message':'Place service unavailable · showing the dated sourced snapshot. Your trip remains usable.'})
            else:
                places=await self.wikipedia.discover(city)
                if not places:raise TravelError('discovery_unavailable','Place discovery is unavailable or this source has no qualified nearby attractions. Try a cached destination or retry shortly.',503,True)
                result=HotspotResult(city=city,places=places,source='wikipedia',retrieved_at=datetime.now(timezone.utc),
                    message='Wikipedia geographic places qualified by attraction categories · opening hours, fees and visit availability are unknown; verify before travelling.')
        self.remember(key,result)
        return result
