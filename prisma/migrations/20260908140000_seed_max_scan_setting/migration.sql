-- Seed the default max_scan setting so the counter limit is active out of the box.
-- Operators can update "value" directly in the DB until a settings UI exists.

INSERT INTO "setting" ("parameter", "value")
VALUES ('max_scan', '10')
ON CONFLICT ("parameter") DO NOTHING;
