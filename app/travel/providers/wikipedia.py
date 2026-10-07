"""Keyless fallback: only geographic articles with attraction-specific categories."""
from datetime import datetime, timezone
import re
from urllib.parse import quote
from uuid import NAMESPACE_URL, uuid5
import httpx
from ..models import ResolvedPlace


def decode_pages(raw,city,now):
    from .hotspots import distance
    result=[]
    for page in raw.get('query',{}).get('pages',{}).values():
        cats=[c.get('title','').removeprefix('Category:').lower() for c in page.get('categories',[])]
        if any(any(word in c for word in ['demolished','defunct','proposed','terrorist','attacks','bombings']) for c in cats):continue
        kind=None
        for cat in cats:
            if re.match(r'(?:art |history |science |natural history |railway |archaeological |national |military |maritime |local |technology |biographical )?museums(?: |$)',cat):kind='museum';break
            if re.match(r'(?:national |urban |public |botanical |japanese |royal )?(?:parks|gardens)(?: |$)',cat):kind='nature';break
            if re.match(r'(?:hindu |buddhist |shinto |jain |sikh |roman catholic |anglican |christian )?(?:temples|shrines|churches|cathedrals|mosques)(?: |$)',cat):kind='temple';break
            if re.match(r'(?:monuments and memorials|castles|forts|palaces|world heritage sites|archaeological sites)(?: |$)',cat):kind='heritage';break
            if re.match(r'(?:tourist attractions|landmarks|observation towers)(?: |$)',cat):kind='attraction';break
        if not kind or not page.get('coordinates') or not page.get('title') or not page.get('pageid'):continue
        try:
            coord=page['coordinates'][0]
            p=ResolvedPlace(id=uuid5(NAMESPACE_URL,'wikipedia:en:'+str(page['pageid'])),provider='wikipedia',source_id=str(page['pageid']),
                name=page['title'][:300],latitude=coord['lat'],longitude=coord['lon'],country=city.country,country_code=city.country_code,
                timezone=city.timezone,kind='hotspot',category=kind,retrieved_at=now,
                source_url='https://en.wikipedia.org/?curid='+str(page['pageid']),wikipedia='https://en.wikipedia.org/wiki/'+quote(page['title'].replace(' ','_'),safe=''),
                license='CC-BY-SA-4.0',attribution='Wikipedia contributors · CC BY-SA 4.0',
                recommended_duration_minutes=90 if kind=='museum' else 60)
            p.distance_m=round(distance(p,city))
            if p.distance_m<=8100:result.append(p)
        except (KeyError,ValueError,TypeError):continue
    return sorted(result,key=lambda p:p.distance_m)[:60]


class WikipediaProvider:
    def __init__(self,client):self.client=client
    async def discover(self,city):
        try:
            r=await self.client.get('https://en.wikipedia.org/w/api.php',params={'action':'query','format':'json',
                'generator':'geosearch','ggscoord':f'{city.latitude}|{city.longitude}','ggsradius':8000,'ggslimit':100,'ggsnamespace':0,
                'prop':'coordinates|categories','colimit':'max','cllimit':500,'clshow':'!hidden'},timeout=8,
                headers={'User-Agent':'PayanamHackathon/1.0 (https://github.com/Krithika-2525/Payanam-2.0)'})
            r.raise_for_status()
            if len(r.content)>1_000_000:raise ValueError('Response too large')
            return decode_pages(r.json(),city,datetime.now(timezone.utc))
        except (httpx.HTTPError,ValueError,TypeError):return []
