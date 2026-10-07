"""Bounded private itinerary preferences, timing and travel tools; existing RLS retained."""
from alembic import op
revision='0003_planning_envelope'
down_revision='0002_legacy_envelope'
branch_labels=None
depends_on=None

def upgrade():
    op.execute('ALTER TABLE travel.trips ADD COLUMN planning jsonb CHECK(octet_length(planning::text)<=32768)')

def downgrade():
    raise RuntimeError('Restore a backup rather than discard private traveler planning details.')
