import os
import httpx
from uuid import UUID
from typing import Literal
from pydantic import Field
from ..models import StrictModel

class RouteRequest(StrictModel):
    city_id: UUID
    place_ids: list[UUID]=Field(max_length=20)
    mode: Literal['walk','drive']='drive'

async def road_route(client,city,places,mode):
    key=os.getenv('OPENROUTESERVICE_API_KEY','')
    if not key or os.getenv('ORS_ZERO_BILLING_CONFIRMED')!='true':
        return {'available':False,'message':'Road routing needs an optional free openrouteservice key. Estimated links remain available.'}
    if not places:return {'available':False,'message':'Add stops before requesting a route.'}
    coordinates=[[p.longitude,p.latitude] for p in [city,*places,city]]
    profile='foot-walking' if mode=='walk' else 'driving-car'
    try:
        r=await client.post('https://api.openrouteservice.org/v2/directions/'+profile+'/geojson',
            headers={'Authorization':key},json={'coordinates':coordinates},timeout=10)
        r.raise_for_status()
        data=r.json()['features'][0]
        return {'available':True,'geometry':data['geometry'],'summary':data['properties']['summary'],
                'segments':data['properties'].get('segments',[]),'source':'openrouteservice',
                'attribution':'© openrouteservice.org · © OpenStreetMap contributors',
                'message':'Road route estimate. No live traffic; itinerary times retain their planning estimates.'}
    except (httpx.HTTPError,ValueError,KeyError,IndexError):
        return {'available':False,'message':'Road routing is unavailable. Your estimated itinerary is unchanged.'}
