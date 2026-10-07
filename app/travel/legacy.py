"""Legacy imports preserve evidence, never certify illustrative travel facts."""
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import hmac
import json
from uuid import NAMESPACE_URL, uuid5

from app.planning.models import PlanResult
from app.planning.catalog import DATASET_VERSION
from app.planning.solver import _signature
from .models import ResolvedPlace,TripCreate,StrictModel
from .errors import TravelError


class LegacyRequest(StrictModel):
    original: str


@dataclass
class LegacyImport:
    original: str
    digest: str
    verified: bool
    metadata: TripCreate
    places: list[ResolvedPlace]


def decode_legacy(raw):
    try:
        if len(raw.encode('utf-8'))>65536:raise ValueError('Too large.')
        value=json.loads(raw)
        if value.get('kind')!='payanam-journey' or value.get('version')!=1 or set(value)!={'kind','version','plan'}:
            raise ValueError('Unsupported envelope.')
        plan=PlanResult.model_validate(value['plan'])
        verified=hmac.compare_digest(plan.signature,_signature(plan)) and plan.dataset_version==DATASET_VERSION
        now=datetime.now(timezone.utc)
        places=[ResolvedPlace(id=uuid5(NAMESPACE_URL,'legacy-illustrative:'+s.place_id),provider='legacy-illustrative',
                   source_id=s.place_id,name=s.name,local_name=s.tamil_name,country='India',country_code='IN',
                   longitude=s.lon,latitude=s.lat,timezone='Asia/Kolkata',kind='illustrative',retrieved_at=now,
                   source_url=None,license='unqualified-legacy',attribution='Legacy illustrative data · not verified real-world facts') for s in plan.stops]
        return LegacyImport(raw,hashlib.sha256(raw.encode()).hexdigest(),verified,
            TripCreate(title='Imported illustrative journey',start_date=plan.request.date,end_date=plan.request.date),places)
    except (ValueError,TypeError,AttributeError,KeyError) as exc:
        raise TravelError('invalid_legacy','Choose a valid version 1 Payanam export smaller than 64 KB.',422) from exc
