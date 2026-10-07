"""Bounded original legacy payload, private under trip RLS."""
from alembic import op
revision='0002_legacy_envelope'
down_revision='0001_travel_private'
branch_labels=None
depends_on=None

def upgrade():
    op.execute('ALTER TABLE travel.trips ADD COLUMN legacy_envelope text CHECK(octet_length(legacy_envelope)<=65536)')
    op.execute('ALTER TABLE travel.trips ADD COLUMN legacy_hash text')
    op.execute('CREATE UNIQUE INDEX legacy_owner_hash ON travel.trips(owner_id,legacy_hash) WHERE legacy_hash IS NOT NULL')

def downgrade():
    raise RuntimeError('Restore a backup rather than discard private traveler data.')
