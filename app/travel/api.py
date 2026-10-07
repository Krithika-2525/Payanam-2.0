import hashlib
from typing import Literal
from uuid import UUID

from fastapi import APIRouter,Depends,Header,Query,Request,Response
from fastapi.security import HTTPBearer,HTTPAuthorizationCredentials
from starlette.concurrency import run_in_threadpool

from .errors import TravelError
from .models import Actor,PlaceQuery,PlaceSearchResult,TripCreate,TripChange,TripDocument,ResolvedPlace
from .legacy import LegacyRequest,decode_legacy

router=APIRouter(prefix='/api/v2',tags=['Travel workspace'])
bearer=HTTPBearer(auto_error=False)


def services(request:Request):return request.app.state.travel


def current_actor(request:Request,credentials:HTTPAuthorizationCredentials|None=Depends(bearer)):
    if not credentials or credentials.scheme.lower()!='bearer':
        raise TravelError('unauthorized','Sign in to access your private trips.',401)
    return services(request).identity.verify(credentials.credentials)


def expected_version(value):
    if value is None:raise TravelError('precondition_required','Refresh this trip before changing it.',428)
    number=value.strip('"')
    if not number.isdigit() or not 1<=int(number)<=2147483647:
        raise TravelError('invalid_version','The trip version is invalid.',422)
    return int(number)


@router.get('/capabilities')
def capabilities(request:Request):return services(request).capabilities()


@router.get('/places/search',response_model=PlaceSearchResult)
async def search(request:Request,q:str=Query(min_length=2,max_length=200),language:str='en',
                 country:str|None=None,limit:int=Query(default=10,ge=1,le=10),source:Literal['cities','places']='cities'):
    try:query=PlaceQuery(q=q,language=language,country=country,limit=limit)
    except ValueError as exc:raise TravelError('invalid_query','Check the search language and country.',422) from exc
    address=request.client.host if request.client else 'unknown'
    bucket=hashlib.sha256(address.encode()).hexdigest()[:32]
    places,cached=await services(request).search(query,source,bucket)
    return PlaceSearchResult(places=places,source='geonames' if source=='cities' else 'geoapify',
        request_id=request.state.request_id,cached=cached,
        message='City snapshot · no venue hours or live prices' if source=='cities' else 'Source records · current hours and prices may be unknown')


@router.get('/places/{place_id}',response_model=ResolvedPlace)
def place(request:Request,place_id:UUID):
    value=services(request).resolve(place_id)
    if value is None:raise TravelError('not_found','This place is unavailable. Search again.',404)
    return value


@router.get('/me')
def me(request:Request,actor:Actor=Depends(current_actor)):
    services(request).repository().ensure_actor(actor)
    return {'id':actor.id,'locale':'en'}


@router.post('/trips',response_model=TripDocument,status_code=201)
def create_trip(request:Request,response:Response,data:TripCreate,actor:Actor=Depends(current_actor),
                key:str=Header(alias='Idempotency-Key',min_length=8,max_length=100)):
    trip=services(request).repository().create(actor,data,key)
    response.headers['ETag']=f'"{trip.version}"'
    return trip


@router.delete('/me',status_code=204)
def delete_account_data(request:Request,actor:Actor=Depends(current_actor)):
    services(request).repository().delete_account_data(actor)
    return Response(status_code=204)


@router.get('/trips')
def list_trips(request:Request,actor:Actor=Depends(current_actor),limit:int=Query(default=50,ge=1,le=50),cursor:UUID|None=None):
    trips=services(request).repository().list(actor,limit,cursor)
    return {'trips':trips,'next_cursor':trips[-1].id if len(trips)==limit else None}


@router.get('/trips/{trip_id}',response_model=TripDocument)
def get_trip(request:Request,response:Response,trip_id:UUID,actor:Actor=Depends(current_actor)):
    trip=services(request).repository().get(actor,trip_id)
    response.headers['ETag']=f'"{trip.version}"'
    return trip


@router.patch('/trips/{trip_id}',response_model=TripDocument)
def change_trip(request:Request,response:Response,trip_id:UUID,change:TripChange,actor:Actor=Depends(current_actor),
                key:str=Header(alias='Idempotency-Key',min_length=8,max_length=100),version:str|None=Header(default=None,alias='If-Match')):
    repo=services(request).repository()
    if change.kind=='add_item':
        place=services(request).resolve(change.place_id)
        if place is None:raise TravelError('place_not_found','Search for this place again.',404)
        repo.store_places([place])
    trip=repo.revise(actor,trip_id,expected_version(version),change,key)
    response.headers['ETag']=f'"{trip.version}"'
    return trip


@router.delete('/trips/{trip_id}',status_code=204)
def delete_trip(request:Request,trip_id:UUID,actor:Actor=Depends(current_actor),version:str|None=Header(default=None,alias='If-Match')):
    services(request).repository().delete(actor,trip_id,expected_version(version))
    return Response(status_code=204)


@router.get('/trips/{trip_id}/export')
def export_trip(request:Request,trip_id:UUID,actor:Actor=Depends(current_actor)):
    trip=services(request).repository().get(actor,trip_id)
    allowed=[item for item in trip.items if item.place.license in ('CC-BY-4.0','ODbL-1.0')]
    omitted=len(trip.items)-len(allowed)
    return {'kind':'payanam-trip','version':2,'trip':trip.model_copy(update={'items':allowed}),
            'attributions':sorted({item.place.attribution for item in allowed}),
            'export_note':f'{omitted} legacy source record(s) omitted: export rights unqualified.' if omitted else None}


@router.post('/imports/legacy',response_model=TripDocument,status_code=201)
def import_legacy(request:Request,data:LegacyRequest,actor:Actor=Depends(current_actor),
                  key:str=Header(alias='Idempotency-Key',min_length=8,max_length=100)):
    return services(request).repository().import_legacy(actor,decode_legacy(data.original),key)
