import time
import threading
from uuid import NAMESPACE_URL, uuid5

import httpx
import jwt

from .errors import TravelError
from .models import Actor


class IdentityVerifier:
    """Verify identity cryptographically; profile metadata never grants access."""
    def __init__(self, issuer, audience, client=None):
        self.issuer,self.audience=issuer,audience
        if issuer and not issuer.startswith('https://'):
            raise ValueError('Authentication issuer must use HTTPS.')
        self.client=client or httpx.Client(timeout=5)
        self.keys={}
        self.loaded_at=0
        self.attempted_at=0
        self.lock=threading.Lock()

    def refresh(self):
        self.attempted_at=time.monotonic()
        try:
            response=self.client.get(self.issuer+'/.well-known/jwks.json',timeout=5)
            response.raise_for_status()
            keys=response.json()['keys']
            self.keys={key['kid']:key for key in keys if key.get('alg') in ('RS256','ES256') and key.get('use','sig')=='sig'}
            self.loaded_at=time.monotonic()
        except (httpx.HTTPError,ValueError,KeyError,TypeError) as exc:
            raise TravelError('identity_unavailable','Sign-in verification is temporarily unavailable. Your draft is safe.',503,True) from exc

    def verify(self, token):
        if not self.issuer:
            raise TravelError('identity_not_configured','Cloud sign-in will be available when the project is connected.',503)
        if not token or len(token)>16000:
            raise TravelError('unauthorized','Sign in to access this trip.',401)
        try:
            header=jwt.get_unverified_header(token)
            if header.get('alg') not in ('RS256','ES256') or not header.get('kid'):
                raise ValueError('Unsupported signing key.')
            with self.lock:
                now=time.monotonic()
                if (now-self.loaded_at>300 or header['kid'] not in self.keys) and now-self.attempted_at>=30:
                    self.refresh()
                key=self.keys.get(header['kid'])
            if not key or header['alg']!=key['alg']:
                raise ValueError('Unknown signing key.')
            claims=jwt.decode(token,jwt.PyJWK.from_dict(key).key,algorithms=[key['alg']],
                              issuer=self.issuer,audience=self.audience,options={'require':['iss','aud','sub','exp','iat']})
            subject=claims['sub']
            if not isinstance(subject,str) or not subject or len(subject)>200:
                raise ValueError('Invalid identity.')
            return Actor(id=uuid5(NAMESPACE_URL,self.issuer+'|'+subject),issuer=self.issuer,subject=subject)
        except (jwt.PyJWTError,ValueError,KeyError,TypeError) as exc:
            raise TravelError('unauthorized','Your session could not be verified. Please sign in again.',401) from exc

    def close(self):
        self.client.close()
