-- Restructure pattern_detection: remove generated_id (and its FK), label,
-- qr_value, qr_format, and payload_mode. Keep the rest of the audit fields.

ALTER TABLE "pattern_detection"
DROP CONSTRAINT IF EXISTS "pattern_detection_generated_id_fkey";

DROP INDEX IF EXISTS "idx_pattern_detection_generated_id";
DROP INDEX IF EXISTS "idx_pattern_detection_payload_mode";

ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "generated_id";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "label";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "qr_value";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "qr_format";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "payload_mode";
