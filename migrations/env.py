import os
from alembic import context
from sqlalchemy import create_engine

url=os.environ.get('PAYANAM_MIGRATION_DATABASE_URL')
if not url:
    raise RuntimeError('Set PAYANAM_MIGRATION_DATABASE_URL to the authorized migration-role connection.')
engine=create_engine(url)
with engine.connect() as connection:
    context.configure(connection=connection)
    with context.begin_transaction():
        context.run_migrations()
