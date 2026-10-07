from datetime import timedelta
import hashlib
import json
from uuid import uuid4

from sqlalchemy import text

from .errors import TravelError
from .models import TripCreate,TripDocument,TripItem,ResolvedPlace


class TripRepository:
    def __init__(self,db):self.db=db

    def _actor(self,c,actor):
        c.execute(text('insert into travel.users(id,issuer,subject) values(:id,:issuer,:subject) on conflict(id) do nothing'),
                  {'id':actor.id,'issuer':actor.issuer,'subject':actor.subject})
        row=c.execute(text('select deactivated_at from travel.users where id=:id for update'),{'id':actor.id}).one()
        if row.deactivated_at is not None:raise TravelError('unauthorized','This account has been deactivated.',401)

    def ensure_actor(self,actor):
        with self.db.transaction(actor) as c:self._actor(c,actor)

    def delete_account_data(self,actor):
        with self.db.transaction(actor) as c:
            self._actor(c,actor)
            c.execute(text('delete from travel.trips where owner_id=:id'),{'id':actor.id})
            c.execute(text('update travel.users set deactivated_at=now() where id=:id'),{'id':actor.id})

    def _document(self,c,trip_id,lock=False):
        row=c.execute(text('select * from travel.trips where id=:id'+(' for update' if lock else '')),{'id':trip_id}).mappings().first()
        if row is None:raise TravelError('not_found','This trip is unavailable.',404)
        items=c.execute(text('select * from travel.trip_items where trip_id=:id order by day_index,position,id'),{'id':trip_id}).mappings()
        return TripDocument(**{k:row[k] for k in ['id','title','start_date','end_date','timezone','currency','planning','version','origin','created_at','updated_at']},
            items=[TripItem(id=i['id'],day_index=i['day_index'],position=i['position'],notes=i['notes'],place=ResolvedPlace.model_validate(i['place'])) for i in items])

    def get(self,actor,trip_id):
        with self.db.transaction(actor) as c:
            self._actor(c,actor)
            return self._document(c,trip_id)

    def list(self,actor,limit=50,cursor=None):
        with self.db.transaction(actor) as c:
            self._actor(c,actor)
            # UUID cursor yields stable bounded pages without exposing another owner's rows.
            rows=c.execute(text('select id from travel.trips where (cast(:cursor as uuid) is null or id>cast(:cursor as uuid)) order by id limit :limit'),
                           {'cursor':str(cursor) if cursor else None,'limit':min(limit,50)}).scalars().all()
            return [self._document(c,id) for id in rows]

    def _days(self,c,trip_id,data):
        count=(data.end_date-data.start_date).days+1
        for day in range(count):
            c.execute(text('insert into travel.trip_days(trip_id,day_index,local_date,timezone) values(:id,:day,:date,:timezone) '
                           'on conflict(trip_id,day_index) do update set local_date=excluded.local_date,timezone=excluded.timezone'),
                      {'id':trip_id,'day':day,'date':data.start_date+timedelta(days=day),'timezone':data.timezone})
        c.execute(text('delete from travel.trip_days where trip_id=:id and day_index>=:count'),{'id':trip_id,'count':count})

    def _dedupe(self,c,actor,operation,key,payload):
        if not 8<=len(key)<=100:raise TravelError('invalid_idempotency_key','A valid request key is required.',422)
        digest=hashlib.sha256(payload.encode()).hexdigest()
        # Serialize only the same actor/operation/key, including first-time concurrent requests.
        lock=hashlib.sha256((str(actor.id)+'|'+operation+'|'+key).encode()).digest()[:8]
        c.execute(text('select pg_advisory_xact_lock(:key)'),{'key':int.from_bytes(lock,'big',signed=True)})
        row=c.execute(text('select request_hash,response from travel.request_keys where actor_id=:actor and operation=:op and key=:key'),
                      {'actor':actor.id,'op':operation,'key':key}).mappings().first()
        if row:
            if row['request_hash']!=digest:raise TravelError('idempotency_conflict','This retry differs from the original request.',409)
            return digest,TripDocument.model_validate(row['response'])
        return digest,None

    def _record(self,c,actor,operation,key,digest,trip,change):
        c.execute(text('insert into travel.request_keys(actor_id,operation,key,request_hash,trip_id,response) '
                       'values(:actor,:op,:key,:hash,:trip,cast(:response as jsonb))'),
                  {'actor':actor.id,'op':operation,'key':key,'hash':digest,'trip':trip.id,'response':trip.model_dump_json()})
        c.execute(text('insert into travel.trip_revisions(trip_id,version,actor_id,change) values(:trip,:version,:actor,cast(:change as jsonb))'),
                  {'trip':trip.id,'version':trip.version,'actor':actor.id,'change':change})
        c.execute(text('insert into travel.outbox_events(trip_id,version,event_type) values(:trip,:version,:type)'),
                  {'trip':trip.id,'version':trip.version,'type':'trip_changed'})

    def create(self,actor,data,key):
        with self.db.transaction(actor) as c:
            self._actor(c,actor)
            digest,previous=self._dedupe(c,actor,'create',key,data.model_dump_json())
            if previous:return previous
            id=uuid4()
            c.execute(text('insert into travel.trips(id,owner_id,title,start_date,end_date,timezone,currency,planning) '
                           'values(:id,:owner,:title,:start_date,:end_date,:timezone,:currency,cast(:planning as jsonb))'),
                      {'id':id,'owner':actor.id,**data.model_dump(), 'planning':data.planning.model_dump_json() if data.planning else None})
            self._days(c,id,data)
            trip=self._document(c,id)
            self._record(c,actor,'create',key,digest,trip,json.dumps({'kind':'create'}))
            return trip

    def revise(self,actor,trip_id,expected_version,change,key):
        with self.db.transaction(actor) as c:
            self._actor(c,actor)
            digest,previous=self._dedupe(c,actor,'change:'+str(trip_id),key,str(expected_version)+'|'+change.model_dump_json())
            if previous:return previous
            trip=self._document(c,trip_id,True)
            if trip.version!=expected_version:raise TravelError('version_conflict','This trip changed elsewhere. Review the latest version before saving.',409)
            if change.kind=='update_metadata':
                d=change.metadata
                if any(i.day_index>(d.end_date-d.start_date).days for i in trip.items):
                    raise TravelError('invalid_days','Move visits before shortening this trip.',422)
                c.execute(text('update travel.trips set title=:title,start_date=:start_date,end_date=:end_date,timezone=:timezone,currency=:currency,planning=cast(:planning as jsonb) where id=:id'),
                          {'id':trip_id,**d.model_dump(), 'planning':d.planning.model_dump_json() if d.planning else None})
                self._days(c,trip_id,d)
            elif change.kind=='add_item':
                if len(trip.items)>=200:raise TravelError('item_limit','This trip supports up to 200 places.',422)
                self._validate_day(trip,change.day_index)
                place=c.execute(text('select snapshot from travel.places where id=:id'),{'id':change.place_id}).scalar()
                if place is None:raise TravelError('place_not_found','Search for this place again before adding it.',404)
                position=max((i.position for i in trip.items if i.day_index==change.day_index),default=-1)+1
                c.execute(text('insert into travel.trip_items(id,trip_id,day_index,position,place,notes) values(:id,:trip,:day,:position,cast(:place as jsonb),:notes)'),
                          {'id':uuid4(),'trip':trip_id,'day':change.day_index,'position':position,'place':json.dumps(place),'notes':change.notes or ''})
            else:
                item=next((i for i in trip.items if i.id==change.item_id),None)
                if item is None:raise TravelError('item_not_found','This visit is unavailable.',404)
                if change.kind=='remove_item':
                    c.execute(text('delete from travel.trip_items where id=:id'),{'id':item.id})
                    self._normalize_day(c,trip_id,item.day_index)
                elif change.kind=='update_item':
                    c.execute(text('update travel.trip_items set notes=:notes where id=:id'),{'id':item.id,'notes':change.notes})
                else:
                    self._validate_day(trip,change.day_index)
                    target=[i for i in trip.items if i.day_index==change.day_index and i.id!=item.id]
                    target.insert(min(change.position if change.position is not None else len(target),len(target)),item)
                    for position,current in enumerate(target):
                        c.execute(text('update travel.trip_items set day_index=:day,position=:position where id=:id'),
                                  {'id':current.id,'day':change.day_index,'position':position})
                    if item.day_index!=change.day_index:self._normalize_day(c,trip_id,item.day_index)
            c.execute(text('update travel.trips set version=version+1,updated_at=now() where id=:id'),{'id':trip_id})
            updated=self._document(c,trip_id)
            self._record(c,actor,'change:'+str(trip_id),key,digest,updated,change.model_dump_json())
            return updated

    def _normalize_day(self,c,trip_id,day):
        ids=c.execute(text('select id from travel.trip_items where trip_id=:trip and day_index=:day order by position,id'),
                      {'trip':trip_id,'day':day}).scalars().all()
        for position,id in enumerate(ids):
            c.execute(text('update travel.trip_items set position=:position where id=:id'),{'position':position,'id':id})

    def import_legacy(self,actor,data,key):
        with self.db.transaction(actor) as c:
            self._actor(c,actor)
            digest,previous=self._dedupe(c,actor,'import:'+data.digest,key,data.digest)
            if previous:return previous
            c.execute(text('select pg_advisory_xact_lock(hashtextextended(:hash,0))'),{'hash':str(actor.id)+'|'+data.digest})
            existing=c.execute(text('select id from travel.trips where legacy_hash=:hash'),{'hash':data.digest}).scalar()
            if existing:return self._document(c,existing)
            id=uuid4()
            origin='legacy-illustrative-'+('signature-valid' if data.verified else 'unverified')
            c.execute(text('insert into travel.trips(id,owner_id,title,start_date,end_date,timezone,currency,origin,legacy_envelope,legacy_hash) '
                           'values(:id,:owner,:title,:start_date,:end_date,:timezone,:currency,:origin,:original,:hash)'),
                      {'id':id,'owner':actor.id,**data.metadata.model_dump(),'origin':origin,'original':data.original,'hash':data.digest})
            self._days(c,id,data.metadata)
            for position,place in enumerate(data.places):
                c.execute(text('insert into travel.trip_items(id,trip_id,day_index,position,place,notes) values(:id,:trip,0,:position,cast(:place as jsonb),:notes)'),
                          {'id':uuid4(),'trip':id,'position':position,'place':place.model_dump_json(),'notes':'Imported illustrative stop. Check real places before travelling.'})
            trip=self._document(c,id)
            self._record(c,actor,'import:'+data.digest,key,digest,trip,json.dumps({'kind':'import_legacy','source_hash':data.digest}))
            return trip

    @staticmethod
    def _validate_day(trip,day):
        if day is None or day>(trip.end_date-trip.start_date).days:raise TravelError('invalid_day','Choose a day within this trip.',422)

    def delete(self,actor,trip_id,expected_version):
        with self.db.transaction(actor) as c:
            self._actor(c,actor)
            trip=self._document(c,trip_id,True)
            if trip.version!=expected_version:raise TravelError('version_conflict','Review the latest trip before deleting it.',409)
            c.execute(text('delete from travel.trips where id=:id'),{'id':trip_id})

    def store_places(self,places):
        with self.db.transaction() as c:
            for p in places:
                c.execute(text('insert into travel.places(id,provider,source_id,snapshot,point,retrieved_at) '
                    'values(:id,:provider,:source,cast(:snapshot as jsonb),ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography,:time) '
                    'on conflict(id) do update set snapshot=excluded.snapshot,point=excluded.point,retrieved_at=excluded.retrieved_at'),
                    {'id':p.id,'provider':p.provider,'source':p.source_id,'snapshot':p.model_dump_json(),'lon':p.longitude,'lat':p.latitude,'time':p.retrieved_at})

    def place(self,id):
        with self.db.transaction() as c:
            p=c.execute(text('select snapshot from travel.places where id=:id'),{'id':id}).scalar()
            return ResolvedPlace.model_validate(p) if p else None

    def reserve_credits(self,bucket,amount,cap):
        with self.db.transaction() as c:
            result=c.execute(text('insert into travel.provider_usage(bucket,used) select :bucket,:amount where :amount<=:cap '
                                 'on conflict(bucket) do update set used=travel.provider_usage.used+excluded.used '
                                 'where travel.provider_usage.used+excluded.used<=:cap returning used'),
                             {'bucket':bucket,'amount':amount,'cap':cap}).scalar()
            if result is None:raise TravelError('free_limit','The free search limit has been reached. City search and saved trips remain available.',429,True)

    def cache_get(self,key):
        with self.db.transaction() as c:
            return c.execute(text('select response from travel.provider_cache where key=:key and expires_at>now()'),{'key':key}).scalar()

    def cache_put(self,key,response):
        with self.db.transaction() as c:
            c.execute(text("insert into travel.provider_cache(key,response,expires_at) values(:key,cast(:data as jsonb),now()+interval '1 day') "
                           'on conflict(key) do update set response=excluded.response,expires_at=excluded.expires_at'),{'key':key,'data':json.dumps(response)})
