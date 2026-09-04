import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const schema = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const migration = readFileSync(
  path.join(root, 'prisma', 'migrations', '20260903120000_init_dotvera_v3', 'migration.sql'),
  'utf8',
);
const scannedCountMigration = readFileSync(
  path.join(root, 'prisma', 'migrations', '20260904120000_add_pattern_generated_scanned_count', 'migration.sql'),
  'utf8',
);
const resultCountMigration = readFileSync(
  path.join(root, 'prisma', 'migrations', '20260904130000_add_pattern_generated_result_counts', 'migration.sql'),
  'utf8',
);

test('Prisma schema maps the three V3.1 tables', () => {
  assert.match(schema, /@@map\("user"\)/);
  assert.match(schema, /@@map\("pattern_generated"\)/);
  assert.match(schema, /@@map\("pattern_detection"\)/);
  assert.match(schema, /@map\("password_hash"\)/);
  assert.match(schema, /@map\("create_at"\)/);
  assert.match(schema, /@map\("deviceID"\)/);
  assert.match(schema, /patternPayload\s+String\s+@unique/);
  assert.match(schema, /scannedCount\s+Int\s+@default\(0\)\s+@map\("scanned_count"\)/);
  assert.match(schema, /authenticCount\s+Int\s+@default\(0\)\s+@map\("authentic_count"\)/);
  assert.match(schema, /counterfeitCount\s+Int\s+@default\(0\)\s+@map\("counterfeit_count"\)/);
  assert.match(schema, /qrSecret1/);
  assert.match(schema, /generatedId/);
  assert.doesNotMatch(schema, /pattern_generated_v21/);
  assert.doesNotMatch(schema, /^\s*serial\s+/m);
  assert.doesNotMatch(schema, /@map\("serial"\)/);
});

test('initial migration creates constraints, indexes, and update triggers', () => {
  assert.match(migration, /CREATE TABLE "user"/);
  assert.match(migration, /CREATE TABLE "pattern_generated"/);
  assert.match(migration, /CREATE TABLE "pattern_detection"/);
  assert.match(migration, /pattern_generated_qr_hvalue_length/);
  assert.match(migration, /pattern_generated_pattern_payload_length/);
  assert.match(migration, /idx_pattern_generated_qr_hvalue/);
  assert.match(migration, /idx_pattern_detection_generated_id/);
  assert.match(migration, /CREATE TRIGGER set_user_update_at/);
  assert.match(migration, /CREATE TRIGGER set_pattern_generated_update_at/);
  assert.match(migration, /CREATE TRIGGER set_pattern_detection_updated_at/);
  assert.match(migration, /REFERENCES "pattern_generated"\("id"\) ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /pattern_generated_v21/);
  assert.doesNotMatch(migration, /left_position/);
});

test('follow-up migration adds non-negative scanned_count on pattern_generated', () => {
  assert.match(scannedCountMigration, /ADD COLUMN "scanned_count" INTEGER NOT NULL DEFAULT 0/);
  assert.match(scannedCountMigration, /pattern_generated_scanned_count_nonnegative/);
  assert.match(scannedCountMigration, /CHECK \("scanned_count" >= 0\)/);
});

test('follow-up migration adds non-negative authentic_count and counterfeit_count', () => {
  assert.match(resultCountMigration, /ADD COLUMN "authentic_count" INTEGER NOT NULL DEFAULT 0/);
  assert.match(resultCountMigration, /ADD COLUMN "counterfeit_count" INTEGER NOT NULL DEFAULT 0/);
  assert.match(resultCountMigration, /pattern_generated_authentic_count_nonnegative/);
  assert.match(resultCountMigration, /pattern_generated_counterfeit_count_nonnegative/);
  assert.match(resultCountMigration, /CHECK \("authentic_count" >= 0\)/);
  assert.match(resultCountMigration, /CHECK \("counterfeit_count" >= 0\)/);
});
