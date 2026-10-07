"""Private trips, PostGIS places, RLS and durable provider quotas."""
from pathlib import Path
from alembic import op

revision='0001_travel_private'
down_revision=None
branch_labels=None
depends_on=None


def upgrade():
    sql=(Path(__file__).parent.parent/'travel_schema.sql').read_text()
    # No parameters: PostgreSQL format('%I') placeholders belong to the SQL,
    # not psycopg's parameter binder. Keep Alembic's surrounding transaction.
    with op.get_bind().connection.driver_connection.cursor() as cursor:
        cursor.execute(sql)


def downgrade():
    raise RuntimeError('Do not drop traveler data. Restore the tested backup or use an additive corrective migration.')
