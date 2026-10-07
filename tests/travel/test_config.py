import jwt
import pytest
from app.travel.config import Settings


@pytest.mark.parametrize('key',['sb_secret_private',jwt.encode({'role':'service_role'},'test-only-secret-with-at-least-32-bytes',algorithm='HS256'),'arbitrary-key'])
def test_private_or_unknown_key_never_reaches_browser(monkeypatch,key):
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY',key)
    with pytest.raises(ValueError):Settings.from_env()


def test_public_key_allowed(monkeypatch):
    monkeypatch.setenv('SUPABASE_PUBLISHABLE_KEY','sb_publishable_public')
    assert Settings.from_env().supabase_publishable_key=='sb_publishable_public'
