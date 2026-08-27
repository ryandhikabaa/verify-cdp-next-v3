import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeV3Payload, encodeV3Payload, validateV3Payload} from '../lib/cdp/v3-payload';

test('round trips supported payloads', () => {
  for (const payload of ['', 'A', 'abc-09_', 'ABCDEFGHIJKLMNOPQRSTUVWX']) {
    assert.equal(decodeV3Payload(encodeV3Payload(payload)).payload, payload);
  }
});

test('rejects invalid payloads', () => {
  assert.throws(() => validateV3Payload('ABCDEFGHIJKLMNOPQRSTUVWXY'));
  assert.throws(() => validateV3Payload('invalid space'));
  assert.throws(() => validateV3Payload('é'));
});

test('rejects an uncorrectable tampered codeword through CRC validation', () => {
  const codeword = encodeV3Payload('Reliable-v3');
  for (const index of [0, 1, 2, 3, 4, 5]) codeword[index] ^= 0x01;
  assert.throws(() => decodeV3Payload(codeword));
});

test('rejects invalid codeword length', () => {
  assert.throws(() => decodeV3Payload(new Uint8Array(31)));
});
