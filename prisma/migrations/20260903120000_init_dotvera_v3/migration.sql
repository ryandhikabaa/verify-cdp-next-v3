CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nama" VARCHAR(255) NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "create_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMPTZ(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_username_key" ON "user"("username");
CREATE INDEX "idx_user_username" ON "user"("username");

CREATE TABLE "pattern_generated" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "qr_payload" TEXT NOT NULL,
    "qr_hvalue" VARCHAR(7) NOT NULL,
    "qr_secret1" TEXT NOT NULL,
    "qr_secret2" TEXT NOT NULL,
    "qr_image" TEXT NOT NULL,
    "pattern_payload" VARCHAR(24) NOT NULL,
    "image_data" TEXT,
    "image_blob" BYTEA,
    "density" DOUBLE PRECISION NOT NULL,
    "size" INTEGER,
    "style" VARCHAR(100),
    "layout_version" VARCHAR(50) NOT NULL DEFAULT 'v3-qr-pattern',
    "qr_width_px" INTEGER,
    "qr_height_px" INTEGER,
    "pattern_width_px" INTEGER,
    "pattern_height_px" INTEGER,
    "gap_px" INTEGER,
    "canvas_width_px" INTEGER,
    "canvas_height_px" INTEGER,
    "create_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_generated_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pattern_generated_qr_hvalue_length" CHECK (char_length("qr_hvalue") BETWEEN 1 AND 7),
    CONSTRAINT "pattern_generated_pattern_payload_length" CHECK (char_length("pattern_payload") BETWEEN 1 AND 24)
);

CREATE UNIQUE INDEX "pattern_generated_pattern_payload_key" ON "pattern_generated"("pattern_payload");
CREATE INDEX "idx_pattern_generated_layout_version" ON "pattern_generated"("layout_version");
CREATE INDEX "idx_pattern_generated_qr_hvalue" ON "pattern_generated"("qr_hvalue");
CREATE INDEX "idx_pattern_generated_qr_payload" ON "pattern_generated"("qr_payload");

CREATE TABLE "pattern_detection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deviceID" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "image_data" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "qr_payload" TEXT,
    "qr_hvalue" VARCHAR(7),
    "qr_secret1" TEXT,
    "qr_secret2" TEXT,
    "pattern_payload" VARCHAR(24),
    "pattern_decode_payload" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_detection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_pattern_detection_device_id" ON "pattern_detection"("deviceID");
CREATE INDEX "idx_pattern_detection_pattern_payload" ON "pattern_detection"("pattern_payload");

CREATE OR REPLACE FUNCTION set_user_update_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.update_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_pattern_generated_update_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.update_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_pattern_detection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_update_at
BEFORE UPDATE ON "user"
FOR EACH ROW
EXECUTE FUNCTION set_user_update_at();

CREATE TRIGGER set_pattern_generated_update_at
BEFORE UPDATE ON pattern_generated
FOR EACH ROW
EXECUTE FUNCTION set_pattern_generated_update_at();

CREATE TRIGGER set_pattern_detection_updated_at
BEFORE UPDATE ON pattern_detection
FOR EACH ROW
EXECUTE FUNCTION set_pattern_detection_updated_at();
