DROP INDEX IF EXISTS "idx_pattern_detection_qr_detected";
DROP INDEX IF EXISTS "idx_pattern_detection_layout_version";

ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "qr_detected";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "qr_bounds";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "layout_version";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "decrypt_succeeded";
ALTER TABLE "pattern_detection" DROP COLUMN IF EXISTS "checksum_valid";
