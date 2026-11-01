-- freshed: initial schema.
-- Drafts live in components/screens/flows and are freely editable.
-- Published content lives in versions, which are immutable snapshots.

CREATE TABLE components (
  name        text PRIMARY KEY,
  definition  jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE screens (
  slug        text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE flows (
  slug        text PRIMARY KEY,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE versions (
  number            integer PRIMARY KEY,
  protocol          integer NOT NULL CHECK (protocol >= 1),
  message           text NOT NULL DEFAULT '',
  hash              text NOT NULL,
  snapshot          jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        text,
  rolled_back_from  integer REFERENCES versions (number)
);

CREATE INDEX versions_protocol_number_idx ON versions (protocol, number DESC);

-- Published versions are immutable. Rollback publishes a new version.
CREATE FUNCTION freshed_versions_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'versions are immutable (attempted %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER versions_no_update
  BEFORE UPDATE OR DELETE ON versions
  FOR EACH ROW EXECUTE FUNCTION freshed_versions_immutable();

-- API keys are stored as SHA-256 hashes; the plaintext is shown once.
CREATE TABLE api_keys (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('public', 'admin')),
  prefix      text NOT NULL,
  key_hash    text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);
