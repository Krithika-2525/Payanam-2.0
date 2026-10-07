CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS travel;
SET search_path TO travel,public,extensions;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='payanam_app') THEN
  CREATE ROLE payanam_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
END IF; END $$;
CREATE TABLE travel.users (
  id uuid PRIMARY KEY, issuer text NOT NULL, subject text NOT NULL,
  deactivated_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(issuer,subject)
);
CREATE TABLE travel.places (
  id uuid PRIMARY KEY, provider text NOT NULL, source_id text NOT NULL,
  snapshot jsonb NOT NULL, point geography(Point,4326) NOT NULL,
  retrieved_at timestamptz NOT NULL, UNIQUE(provider,source_id)
);
CREATE INDEX places_point_idx ON travel.places USING gist(point);
CREATE TABLE travel.trips (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES travel.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120), start_date date NOT NULL,end_date date NOT NULL,
  timezone text NOT NULL,currency text NOT NULL,version integer NOT NULL DEFAULT 1 CHECK(version>=1),
  origin text NOT NULL DEFAULT 'user', created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(end_date>=start_date AND end_date-start_date<30)
);
CREATE INDEX trips_owner_updated_idx ON travel.trips(owner_id,updated_at DESC,id);
CREATE TABLE travel.trip_days (
  trip_id uuid NOT NULL REFERENCES travel.trips(id) ON DELETE CASCADE,day_index integer NOT NULL CHECK(day_index BETWEEN 0 AND 29),
  local_date date NOT NULL,timezone text NOT NULL,PRIMARY KEY(trip_id,day_index)
);
CREATE TABLE travel.trip_items (
  id uuid PRIMARY KEY,trip_id uuid NOT NULL REFERENCES travel.trips(id) ON DELETE CASCADE,
  day_index integer NOT NULL,position integer NOT NULL CHECK(position BETWEEN 0 AND 199),
  place jsonb NOT NULL, notes text NOT NULL DEFAULT '' CHECK(length(notes)<=4000),
  FOREIGN KEY(trip_id,day_index) REFERENCES travel.trip_days(trip_id,day_index)
);
CREATE INDEX trip_items_trip_idx ON travel.trip_items(trip_id,day_index,position,id);
CREATE TABLE travel.trip_revisions (
  trip_id uuid NOT NULL REFERENCES travel.trips(id) ON DELETE CASCADE,version integer NOT NULL,
  actor_id uuid NOT NULL REFERENCES travel.users(id) ON DELETE CASCADE,change jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(trip_id,version)
);
CREATE TABLE travel.request_keys (
  actor_id uuid NOT NULL REFERENCES travel.users(id) ON DELETE CASCADE,operation text NOT NULL,key text NOT NULL,
  request_hash text NOT NULL,trip_id uuid NOT NULL REFERENCES travel.trips(id) ON DELETE CASCADE,
  response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,operation,key)
);
CREATE TABLE travel.outbox_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,trip_id uuid NOT NULL REFERENCES travel.trips(id) ON DELETE CASCADE,
  version integer NOT NULL,event_type text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE travel.provider_cache (
  key text PRIMARY KEY,response jsonb NOT NULL,expires_at timestamptz NOT NULL
);
CREATE TABLE travel.provider_usage (
  bucket text PRIMARY KEY,used integer NOT NULL CHECK(used>=0),created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE travel.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.users FORCE ROW LEVEL SECURITY;
CREATE POLICY own_user ON travel.users TO payanam_app USING (id::text=current_setting('payanam.actor_id',true))
  WITH CHECK(id::text=current_setting('payanam.actor_id',true));
ALTER TABLE travel.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.trips FORCE ROW LEVEL SECURITY;
CREATE POLICY own_trip ON travel.trips TO payanam_app USING(owner_id::text=current_setting('payanam.actor_id',true))
  WITH CHECK(owner_id::text=current_setting('payanam.actor_id',true));
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['trip_days','trip_items','trip_revisions','outbox_events'] LOOP
    EXECUTE format('ALTER TABLE travel.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('ALTER TABLE travel.%I FORCE ROW LEVEL SECURITY',tab);
    EXECUTE format('CREATE POLICY own_trip_child ON travel.%I TO payanam_app USING (EXISTS (SELECT 1 FROM travel.trips t WHERE t.id=trip_id)) WITH CHECK (EXISTS (SELECT 1 FROM travel.trips t WHERE t.id=trip_id))',tab);
  END LOOP;
END $$;
ALTER TABLE travel.request_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel.request_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY own_request ON travel.request_keys TO payanam_app USING(actor_id::text=current_setting('payanam.actor_id',true))
 WITH CHECK(actor_id::text=current_setting('payanam.actor_id',true));
REVOKE ALL ON SCHEMA travel FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA travel FROM PUBLIC;
GRANT USAGE ON SCHEMA travel TO payanam_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA travel TO payanam_app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA travel TO payanam_app;
