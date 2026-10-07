from contextlib import contextmanager

from sqlalchemy import create_engine,text


class Database:
    def __init__(self,url):
        self.engine=create_engine(url,pool_size=3,max_overflow=0,pool_pre_ping=True,pool_timeout=5,hide_parameters=True,
                                  connect_args={'connect_timeout':5})
        try:
            with self.engine.connect() as connection:
                role=connection.execute(text('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).one()
                if role.rolsuper or role.rolbypassrls:
                    raise RuntimeError('Use a limited runtime database role, not the migration owner or an RLS-bypass role.')
        except Exception:
            self.engine.dispose()
            raise

    @contextmanager
    def transaction(self,actor=None):
        with self.engine.begin() as connection:
            connection.execute(text('SET LOCAL search_path TO travel,public,extensions'))
            connection.execute(text("select set_config('payanam.actor_id',:actor,true)"),{'actor':str(actor.id) if actor else ''})
            yield connection

    def close(self):
        self.engine.dispose()
