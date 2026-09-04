ALTER TABLE "pattern_generated"
ADD COLUMN "authentic_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "counterfeit_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "pattern_generated"
ADD CONSTRAINT "pattern_generated_authentic_count_nonnegative"
CHECK ("authentic_count" >= 0);

ALTER TABLE "pattern_generated"
ADD CONSTRAINT "pattern_generated_counterfeit_count_nonnegative"
CHECK ("counterfeit_count" >= 0);
