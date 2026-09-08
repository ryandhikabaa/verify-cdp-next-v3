-- Create key/value application settings table (e.g. max_scan).
-- Extensible without further schema changes; UI comes later.

CREATE TABLE "setting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parameter" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "create_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "setting_parameter_key" ON "setting"("parameter");
CREATE INDEX "idx_setting_parameter" ON "setting"("parameter");
