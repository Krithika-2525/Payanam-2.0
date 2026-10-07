from dataclasses import dataclass
import os
import jwt


@dataclass(frozen=True)
class Settings:
    database_url: str = ''
    auth_issuer: str = ''
    auth_audience: str = 'authenticated'
    geoapify_key: str = ''
    geoapify_zero_billing_confirmed: bool = False
    daily_credits: int = 2400
    supabase_url: str = ''
    supabase_publishable_key: str = ''

    def __post_init__(self):
        key=self.supabase_publishable_key
        if key and not key.startswith('sb_publishable_'):
            try:
                claims=jwt.decode(key,options={'verify_signature':False})
                if claims.get('role')!='anon':raise ValueError('Expected a public key.')
            except (jwt.PyJWTError,ValueError) as exc:
                raise ValueError('SUPABASE_PUBLISHABLE_KEY must be a publishable or legacy anon key.') from exc

    @classmethod
    def from_env(cls):
        if os.getenv('PAYANAM_BILLING_MODE', 'free_only') != 'free_only':
            raise RuntimeError('This release only supports free_only billing mode.')
        supabase = os.getenv('SUPABASE_URL', '').rstrip('/')
        return cls(database_url=os.getenv('DATABASE_URL', ''),
                   auth_issuer=os.getenv('PAYANAM_AUTH_ISSUER', supabase+'/auth/v1' if supabase else ''),
                   auth_audience=os.getenv('PAYANAM_AUTH_AUDIENCE', 'authenticated'),
                   geoapify_key=os.getenv('GEOAPIFY_API_KEY', ''),
                   geoapify_zero_billing_confirmed=os.getenv('GEOAPIFY_ZERO_BILLING_CONFIRMED') == 'true',
                   daily_credits=min(max(int(os.getenv('PAYANAM_DAILY_CREDITS', '2400')), 1), 2400),
                   supabase_url=supabase, supabase_publishable_key=os.getenv('SUPABASE_PUBLISHABLE_KEY',''))
