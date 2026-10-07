from datetime import datetime, timezone
from uuid import NAMESPACE_URL, uuid5

import httpx
from pydantic import ValidationError

from ..errors import TravelError
from ..models import ResolvedPlace


class GeoapifyProvider:
    def __init__(self, key, client):
        self.key, self.client = key, client

    async def search(self, query):
        params={'text':query.q,'limit':query.limit,'lang':query.language,'apiKey':self.key}
        if query.country:
            params['filter']='countrycode:'+query.country.lower()
        try:
            response=await self.client.get('https://api.geoapify.com/v1/geocode/search',params=params,timeout=5)
            if response.status_code==429:
                raise TravelError('provider_quota','Place search is at its free limit. City search is still available.',429,True)
            response.raise_for_status()
            data=response.json()
            if not isinstance(data.get('features'),list):
                raise ValueError('Invalid provider result.')
            places=[]
            for feature in data['features'][:query.limit]:
                p=feature['properties']
                source=p['place_id']
                lon,lat=feature['geometry']['coordinates'][:2]
                places.append(ResolvedPlace(id=uuid5(NAMESPACE_URL,'geoapify:'+source),provider='geoapify',source_id=source,
                    name=p.get('name') or p.get('formatted') or query.q,address=p.get('formatted'),country=p.get('country'),
                    country_code=p.get('country_code','').upper() or None,region=p.get('state'),longitude=lon,latitude=lat,
                    timezone=p.get('timezone',{}).get('name'),retrieved_at=datetime.now(timezone.utc),
                    source_url='https://www.geoapify.com/',kind=p.get('result_type','place')))
            return places
        except (httpx.HTTPError,ValueError,KeyError,TypeError,ValidationError) as exc:
            raise TravelError('provider_unavailable','Place search is temporarily unavailable. Try city search or retry later.',503,True) from exc
