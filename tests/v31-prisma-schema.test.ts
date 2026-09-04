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

test('Prisma schema maps the three V3.1 tables', () => {
  assert.match(schema, /@@map\("user"\)/);
  assert.match(schema, /@@map\("pattern_generated"\)/);
  assert.match(schema, /@@map\("pattern_detection"\)/);
  assert.match(schema, /@map\("password_hash"\)/);
  assert.match(schema, /@map\("create_at"\)/);
  assert.match(schema, /@map\("deviceID"\)/);
  assert.match(schema, /patternPayload\s+String\s+@unique/);
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
