CREATE DATABASE dotvera_v2;

\connect dotvera_v2;

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
  qr_payload TEXT,
  pattern_payload TEXT,
  pattern_seed TEXT,
  image_data TEXT,
  image_blob BYTEA,
  layout_version VARCHAR(50) NOT NULL DEFAULT 'qr-pattern-v2',
  qr_position VARCHAR(20) NOT NULL DEFAULT 'left',
  pattern_position VARCHAR(20) NOT NULL DEFAULT 'right',
  qr_width_px INTEGER,
  qr_height_px INTEGER,
  pattern_width_px INTEGER,
  pattern_height_px INTEGER,
  gap_px INTEGER,
  canvas_width_px INTEGER,
  canvas_height_px INTEGER,
  create_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pattern_generated_v21 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial VARCHAR(255) NOT NULL UNIQUE,
  density DOUBLE PRECISION NOT NULL,
  size INTEGER,
  style VARCHAR(100),
  payload_1 TEXT,
  payload_2 TEXT,
  payload_qr TEXT,
  pattern_seed TEXT,
  image_data TEXT,
  image_blob BYTEA,
  layout_version VARCHAR(50) NOT NULL DEFAULT 'three-part-v2.1',
  left_position VARCHAR(20) NOT NULL DEFAULT 'left',
  qr_position VARCHAR(20) NOT NULL DEFAULT 'center',
  right_position VARCHAR(20) NOT NULL DEFAULT 'right',
  left_width_px INTEGER,
  left_height_px INTEGER,
  qr_width_px INTEGER,
  qr_height_px INTEGER,
  right_width_px INTEGER,
  right_height_px INTEGER,
  gap_px INTEGER,
  canvas_width_px INTEGER,
  canvas_height_px INTEGER,
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
  qr_value TEXT,
  qr_format VARCHAR(50),
  qr_detected BOOLEAN NOT NULL DEFAULT FALSE,
  qr_bounds JSONB,
  pattern_crop_bounds JSONB,
  pattern_decode_payload TEXT,
  rectangular_score DOUBLE PRECISION,
  pattern_confidence DOUBLE PRECISION,
  payload_mode VARCHAR(20),
  decrypt_succeeded BOOLEAN,
  checksum_valid BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS rectangular_score DOUBLE PRECISION;
ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS pattern_confidence DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_user_username ON "user" (username);
CREATE INDEX IF NOT EXISTS idx_pattern_generated_serial ON pattern_generated (serial);
CREATE INDEX IF NOT EXISTS idx_pattern_generated_layout_version ON pattern_generated (layout_version);
CREATE INDEX IF NOT EXISTS idx_pattern_generated_v21_serial ON pattern_generated_v21 (serial);
CREATE INDEX IF NOT EXISTS idx_pattern_generated_v21_layout_version ON pattern_generated_v21 (layout_version);
CREATE INDEX IF NOT EXISTS idx_pattern_detection_device_id ON pattern_detection ("deviceID");
CREATE INDEX IF NOT EXISTS idx_pattern_detection_qr_detected ON pattern_detection (qr_detected);
CREATE INDEX IF NOT EXISTS idx_pattern_detection_payload_mode ON pattern_detection (payload_mode);

CREATE OR REPLACE FUNCTION set_update_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'user' THEN
    NEW.update_at = CURRENT_TIMESTAMP;
  ELSIF TG_TABLE_NAME IN ('pattern_generated', 'pattern_generated_v21') THEN
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

DROP TRIGGER IF EXISTS set_pattern_generated_v21_update_at ON pattern_generated_v21;
CREATE TRIGGER set_pattern_generated_v21_update_at
BEFORE UPDATE ON pattern_generated_v21
FOR EACH ROW
EXECUTE FUNCTION set_update_at();

DROP TRIGGER IF EXISTS set_pattern_detection_updated_at ON pattern_detection;
CREATE TRIGGER set_pattern_detection_updated_at
BEFORE UPDATE ON pattern_detection
FOR EACH ROW
EXECUTE FUNCTION set_update_at();