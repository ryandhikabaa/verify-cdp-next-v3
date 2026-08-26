import 'dotenv/config';
import {randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
import {Pool} from 'pg';

let dotveraPool: Pool | null = null;
let dotveraSchemaPromise: Promise<void> | null = null;

const DOTVERA_IMAGE_PREFIX = 'data:image/png;base64,';

/** Returns a dedicated PostgreSQL pool for the Dotvera database. */
export function getDotveraPool() {
  if (!dotveraPool) {
    dotveraPool = new Pool({
      user: process.env.DOTVERA_DB_USER || process.env.DB_USER || 'ryan',
      host: process.env.DOTVERA_DB_HOST || process.env.DB_HOST || 'localhost',
      database: process.env.DOTVERA_DB_NAME || 'dotvera_v2',
      password: process.env.DOTVERA_DB_PASSWORD || process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DOTVERA_DB_PORT || process.env.DB_PORT || '5432', 10),
    });
  }

  return dotveraPool;
}

/** Ensures the Dotvera tables exist without touching the legacy schema. */
export async function ensureDotveraSchema() {
  if (dotveraSchemaPromise) {
    return dotveraSchemaPromise;
  }

  const pool = getDotveraPool();
  dotveraSchemaPromise = (async () => {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    await pool.query(`
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
    `);

    await pool.query(`
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
    `);

    await pool.query(`
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
    `);

    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS density DOUBLE PRECISION NOT NULL DEFAULT 0;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS size INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS style VARCHAR(100);');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS payload TEXT;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS qr_payload TEXT;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS pattern_payload TEXT;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS pattern_seed TEXT;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS image_data TEXT;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS image_blob BYTEA;');
    await pool.query("ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS layout_version VARCHAR(50) NOT NULL DEFAULT 'qr-pattern-v2';");
    await pool.query("ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS qr_position VARCHAR(20) NOT NULL DEFAULT 'left';");
    await pool.query("ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS pattern_position VARCHAR(20) NOT NULL DEFAULT 'right';");
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS qr_width_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS qr_height_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS pattern_width_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS pattern_height_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS gap_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS canvas_width_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS canvas_height_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS create_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;');
    await pool.query('ALTER TABLE pattern_generated ADD COLUMN IF NOT EXISTS update_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;');

    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS density DOUBLE PRECISION NOT NULL DEFAULT 0;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS size INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS style VARCHAR(100);');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS payload_1 TEXT;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS payload_2 TEXT;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS payload_qr TEXT;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS pattern_seed TEXT;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS image_data TEXT;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS image_blob BYTEA;');
    await pool.query("ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS layout_version VARCHAR(50) NOT NULL DEFAULT 'three-part-v2.1';");
    await pool.query("ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS left_position VARCHAR(20) NOT NULL DEFAULT 'left';");
    await pool.query("ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS qr_position VARCHAR(20) NOT NULL DEFAULT 'center';");
    await pool.query("ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS right_position VARCHAR(20) NOT NULL DEFAULT 'right';");
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS left_width_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS left_height_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS qr_width_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS qr_height_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS right_width_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS right_height_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS gap_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS canvas_width_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS canvas_height_px INTEGER;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS create_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;');
    await pool.query('ALTER TABLE pattern_generated_v21 ADD COLUMN IF NOT EXISTS update_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;');

    await pool.query(`
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
    `);

    await pool.query("ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS label VARCHAR(255) NOT NULL DEFAULT '';");
    await pool.query("ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS \"deviceID\" VARCHAR(255) NOT NULL DEFAULT '';");
    await pool.query("ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'PENDING';");
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS notes TEXT;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS image_data TEXT;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS qr_value TEXT;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS qr_format VARCHAR(50);');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS qr_detected BOOLEAN NOT NULL DEFAULT FALSE;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS qr_bounds JSONB;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS pattern_crop_bounds JSONB;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS pattern_decode_payload TEXT;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS rectangular_score DOUBLE PRECISION;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS pattern_confidence DOUBLE PRECISION;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS payload_mode VARCHAR(20);');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS decrypt_succeeded BOOLEAN;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS checksum_valid BOOLEAN;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;');
    await pool.query('ALTER TABLE pattern_detection ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_username ON "user" (username);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pattern_generated_serial ON pattern_generated (serial);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pattern_generated_layout_version ON pattern_generated (layout_version);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pattern_generated_v21_serial ON pattern_generated_v21 (serial);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pattern_generated_v21_layout_version ON pattern_generated_v21 (layout_version);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pattern_detection_device_id ON pattern_detection ("deviceID");');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pattern_detection_qr_detected ON pattern_detection (qr_detected);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_pattern_detection_payload_mode ON pattern_detection (payload_mode);');

    await pool.query(`
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
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_update_at') THEN
          CREATE TRIGGER set_user_update_at
          BEFORE UPDATE ON "user"
          FOR EACH ROW
          EXECUTE FUNCTION set_update_at();
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_pattern_generated_update_at') THEN
          CREATE TRIGGER set_pattern_generated_update_at
          BEFORE UPDATE ON pattern_generated
          FOR EACH ROW
          EXECUTE FUNCTION set_update_at();
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_pattern_generated_v21_update_at') THEN
          CREATE TRIGGER set_pattern_generated_v21_update_at
          BEFORE UPDATE ON pattern_generated_v21
          FOR EACH ROW
          EXECUTE FUNCTION set_update_at();
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_pattern_detection_updated_at') THEN
          CREATE TRIGGER set_pattern_detection_updated_at
          BEFORE UPDATE ON pattern_detection
          FOR EACH ROW
          EXECUTE FUNCTION set_update_at();
        END IF;
      END
      $$;
    `);
  })();

  try {
    await dotveraSchemaPromise;
  } finally {
    dotveraSchemaPromise = null;
  }
}

/** Converts a PNG data URL into a binary buffer. */
export function dotveraImageDataToBuffer(imageData: unknown) {
  if (typeof imageData !== 'string' || !imageData.startsWith(DOTVERA_IMAGE_PREFIX)) {
    return null;
  }

  return Buffer.from(imageData.slice(DOTVERA_IMAGE_PREFIX.length), 'base64');
}

const DOTVERA_BINARY_TEXT_PREFIX = 'base64:';

/** Encodes binary-string payloads so PostgreSQL text columns never receive NUL bytes. */
export function encodeDotveraBinaryText(value: unknown) {
  if (typeof value !== 'string') return value;
  return `${DOTVERA_BINARY_TEXT_PREFIX}${Buffer.from(value, 'latin1').toString('base64')}`;
}

/** Restores payloads encoded for storage while keeping legacy plain-text rows readable. */
export function decodeDotveraBinaryText(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith(DOTVERA_BINARY_TEXT_PREFIX)) return value;
  return Buffer.from(value.slice(DOTVERA_BINARY_TEXT_PREFIX.length), 'base64').toString('latin1');
}

/** Creates an application-level password hash using scrypt. */
export function hashPassword(password: string) {
  const salt = randomUUID();
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/** Verifies a plain password against a stored scrypt hash. */
export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const incoming = scryptSync(password, salt, 64);
  const existing = Buffer.from(hash, 'hex');

  return existing.length === incoming.length && timingSafeEqual(existing, incoming);
}