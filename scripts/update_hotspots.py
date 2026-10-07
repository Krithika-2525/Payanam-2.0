"""Explicit, low-volume refresh of attributed hackathon destination snapshots."""
import asyncio
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import sys
import httpx
from app.travel.models import PlaceQuery
from app.travel.providers.cities import CityProvider
from app.travel.providers.hotspots import query_for, decode_elements, ENDPOINT

DESTINATIONS=[('Madurai','IN'),('Chennai','IN'),('Jaipur','IN'),('New Delhi','IN'),('Mumbai','IN'),('Bengaluru','IN'),('Kochi','IN'),('Paris','FR'),('Tokyo','JP'),('London','GB'),('Singapore','SG'),('Bangkok','TH')]

async def main():
    path=Path('app/travel/data/hotspots.json.gz')
    document={'provider':'openstreetmap','license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','source_url':ENDPOINT,'cities':{}}
    if path.exists():
        with gzip.open(path,'rt',encoding='utf-8') as f:document=json.load(f)
    async with httpx.AsyncClient(timeout=24) as client:
        for name,country in DESTINATIONS:
            city=CityProvider().search(PlaceQuery(q=name,country=country))[0]
            try:
                r=await client.post(ENDPOINT,data={'data':query_for(city)},headers={'User-Agent':'PayanamHackathon/1.0 snapshot refresh'})
                r.raise_for_status()
                raw=r.json()
                if raw.get('remark'):raise ValueError(raw['remark'])
                now=datetime.now(timezone.utc)
                places=decode_elements(raw,city,now)
                if not places:raise ValueError('No named nearby hotspots')
                existing=document['cities'].get(str(city.id))
                if existing and existing.get('source','openstreetmap')=='openstreetmap':
                    old={p['id']:p for p in existing['places']}
                    old.update({p.id.__str__():p.model_dump(mode='json') for p in places})
                    from app.travel.models import ResolvedPlace
                    places=[ResolvedPlace.model_validate(p) for p in old.values()][:100]
                document['cities'][str(city.id)]={'city':city.model_dump(mode='json'),'retrieved_at':now.isoformat(),'places':[p.model_dump(mode='json') for p in places],'source_url':ENDPOINT,'source':'openstreetmap'}
                temporary=path.with_suffix('.tmp.gz')
                with gzip.open(temporary,'wt',encoding='utf-8') as f:json.dump(document,f,ensure_ascii=False,separators=(',',':'))
                temporary.replace(path)
                print(name,len(places),places[0].name,flush=True)
            except httpx.HTTPStatusError as e:
                print(name,'not updated:',e.response.status_code,flush=True)
                if e.response.status_code==429:
                    print('Provider requested cooldown. Existing snapshots retained; update later.',flush=True)
                    break
            except Exception as e:print(name,'not updated:',type(e).__name__,str(e)[:100],flush=True)
            await asyncio.sleep(3)
    print('Sourced snapshots:',len(document['cities']),flush=True)

if __name__=='__main__':asyncio.run(main())
