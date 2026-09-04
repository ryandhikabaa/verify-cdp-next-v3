ALTER TABLE "pattern_generated"
ADD COLUMN "scanned_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "pattern_generated"
ADD CONSTRAINT "pattern_generated_scanned_count_nonnegative"
CHECK ("scanned_count" >= 0);
