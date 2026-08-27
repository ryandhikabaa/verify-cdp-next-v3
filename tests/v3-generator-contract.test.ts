import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeV3Matrix, generateV3Matrix} from '../lib/cdp/v3-matrix';
import {validateV3Payload} from '../lib/cdp/v3-payload';

test('V3 generator contract preserves the maximum payload through matrix generation', () => {
  const payload = 'Abc012-_XYZ789abcdefghij';
  const validated = validateV3Payload(payload);
  const decoded = decodeV3Matrix(generateV3Matrix(validated));

  assert.equal(decoded.payload, payload);
  assert.equal(decoded.length, 24);
});

test('V3 generator contract rejects payloads outside the approved alphabet or capacity', () => {
  assert.throws(() => validateV3Payload('a'.repeat(25)));
  assert.throws(() => validateV3Payload('payload with spaces'));
});
