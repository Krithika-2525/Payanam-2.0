import time
import json
from uuid import uuid5, NAMESPACE_URL

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.travel.auth import IdentityVerifier
from app.travel.errors import TravelError

ISSUER='https://identity.example/auth/v1'


@pytest.fixture
def signed():
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))|{'kid':'test','alg':'RS256','use':'sig'}
    def token(**claims):
        return jwt.encode({'iss':ISSUER,'aud':'authenticated','sub':'user-a','exp':int(time.time())+300,
                           'iat':int(time.time()),**claims},key,algorithm='RS256',headers={'kid':'test'})
    return jwk,token


def test_identity_requires_verified_signature_issuer_audience(signed):
    jwk,token=signed
    with httpx.Client(transport=httpx.MockTransport(lambda req:httpx.Response(200,json={'keys':[jwk]}))) as c:
        v=IdentityVerifier(ISSUER,'authenticated',c)
        actor=v.verify(token(user_metadata={'role':'admin','owner_id':'user-b'}))
        assert actor.subject=='user-a'
        assert actor.id==uuid5(NAMESPACE_URL,ISSUER+'|user-a')
        for claims in [{'exp':1},{'aud':'other'},{'iss':'https://attacker.example'},{'sub':''}]:
            with pytest.raises(TravelError):v.verify(token(**claims))
        with pytest.raises(TravelError):v.verify(jwt.encode({'sub':'user-a'},key='',algorithm='none'))


def test_unconfigured_identity_is_disabled():
    with pytest.raises(TravelError) as e:IdentityVerifier('','authenticated').verify('anything')
    assert e.value.status==503


def test_jwks_failure_is_recoverable(signed):
    jwk,token=signed
    with httpx.Client(transport=httpx.MockTransport(lambda req:httpx.Response(503))) as c:
        with pytest.raises(TravelError) as e:IdentityVerifier(ISSUER,'authenticated',c).verify(token())
    assert e.value.status==503


def test_unknown_key_requests_do_not_refetch_jwks_each_time(signed):
    jwk,token=signed
    calls=[]
    def fetch(req):
        calls.append(req)
        return httpx.Response(200,json={'keys':[jwk]})
    with httpx.Client(transport=httpx.MockTransport(fetch)) as c:
        verifier=IdentityVerifier(ISSUER,'authenticated',c)
        verifier.verify(token())
        unknown=token().split('.')
        import base64
        unknown[0]=base64.urlsafe_b64encode(json.dumps({'alg':'RS256','kid':'unknown'}).encode()).decode().rstrip('=')
        for _ in range(5):
            with pytest.raises(TravelError):verifier.verify('.'.join(unknown))
        assert len(calls)==1
