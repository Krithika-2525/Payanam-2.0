"""Local browser test ONLY: real DB + RSA JWT verifier; no production auth bypass."""
from contextlib import asynccontextmanager
import json
import os
from pathlib import Path
import time

from cryptography.hazmat.primitives.asymmetric import rsa
import httpx
import jwt

os.environ['PAYANAM_ALLOWED_ORIGINS']='http://127.0.0.1:5180'
os.environ['PAYANAM_AUTH_ISSUER']='https://identity.example/auth/v1'
os.environ['SUPABASE_URL']='https://identity.example'
os.environ['SUPABASE_PUBLISHABLE_KEY']='sb_publishable_test_fixture'
from app.planning.main import app, lifespan

key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))|{'kid':'browser','alg':'RS256','use':'sig'}
tokens={}
for user in ('a','b'):
    subject='00000000-0000-4000-8000-00000000000'+('1' if user=='a' else '2')
    tokens[user]={'token':jwt.encode({'iss':os.environ['PAYANAM_AUTH_ISSUER'],'aud':'authenticated','sub':subject,
                  'iat':int(time.time()),'exp':int(time.time())+3600,'role':'authenticated',
                  'user_metadata':{'role':'admin','owner_id':'other'}},key,algorithm='RS256',headers={'kid':'browser'}),'id':subject}
output=Path('/tmp/payanam-browser-tokens.json')
output.write_text(json.dumps(tokens));output.chmod(0o600)

@asynccontextmanager
async def browser_lifespan(value):
    async with lifespan(value):
        value.state.travel.identity.client.close()
        value.state.travel.identity.client=httpx.Client(transport=httpx.MockTransport(lambda req:httpx.Response(200,json={'keys':[jwk]})))
        yield

app.router.lifespan_context=browser_lifespan
