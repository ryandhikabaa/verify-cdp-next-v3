CREATE DATABASE dotvera;

\connect dotvera;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) NOT NULL,
  create_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pattern_generated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial VARCHAR(255) NOT NULL UNIQUE,
  density DOUBLE PRECISION NOT NULL,
  size INTEGER,
  style VARCHAR(100),
  payload TEXT,
  image_data TEXT,
  image_blob BYTEA,
  create_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pattern_detection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label VARCHAR(255) NOT NULL,
  "deviceID" VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  image_data TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS rectangular_score DOUBLE PRECISION;
ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS pattern_confidence DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_user_username ON "user" (username);
CREATE INDEX IF NOT EXISTS idx_pattern_generated_serial ON pattern_generated (serial);
CREATE INDEX IF NOT EXISTS idx_pattern_detection_device_id ON pattern_detection ("deviceID");

CREATE OR REPLACE FUNCTION set_update_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'user' THEN
    NEW.update_at = CURRENT_TIMESTAMP;
  ELSIF TG_TABLE_NAME = 'pattern_generated' THEN
    NEW.update_at = CURRENT_TIMESTAMP;
  ELSE
    NEW.updated_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_update_at ON "user";
CREATE TRIGGER set_user_update_at
BEFORE UPDATE ON "user"
FOR EACH ROW
EXECUTE FUNCTION set_update_at();

DROP TRIGGER IF EXISTS set_pattern_generated_update_at ON pattern_generated;
CREATE TRIGGER set_pattern_generated_update_at
BEFORE UPDATE ON pattern_generated
FOR EACH ROW
EXECUTE FUNCTION set_update_at();

DROP TRIGGER IF EXISTS set_pattern_detection_updated_at ON pattern_detection;
CREATE TRIGGER set_pattern_detection_updated_at
BEFORE UPDATE ON pattern_detection
FOR EACH ROW
EXECUTE FUNCTION set_update_at();