-- Seed the default hvalue (hidden value) setting so the generator QR anchor
-- has a value out of the box. Operators update it through the Settings UI.

INSERT INTO "setting" ("parameter", "value")
VALUES ('hvalue', 'DOTVERA')
ON CONFLICT ("parameter") DO NOTHING;
