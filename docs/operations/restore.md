# Backup and restore procedure

Before cloud migration, make a PostgreSQL custom-format backup using the administrative migration connection, not a public browser key. Treat it as private traveler data. Pipe it directly into an encryption tool configured for the owner's key; keep only encrypted copies outside the database host. Do not commit backups or credentials. Supabase Free does not supply the commercial backup guarantee this product would need.

Restore into a separate disposable database using the matching PostgreSQL/PostGIS major versions. Create required runtime roles, then `pg_restore --no-owner`; preserve grants/policies, or reapply reviewed grants before accepting traffic. Verify Alembic revision, extensions, row counts, forced RLS, two-account denial, exports and deletion. Route traffic only after these checks; additive corrective migrations are preferred over destructive downgrade.

Local rehearsal on 7 October 2026: PostgreSQL 17/PostGIS 3.5, `pg_dump -Fc` of the real test database, restore into `payanam_restore`, then the real RLS/repository suite using the limited runtime login. No cloud target or production traveler data was involved. This proves the local restore path; owner encryption, backup destination and cloud restore remain to configure after project selection.
