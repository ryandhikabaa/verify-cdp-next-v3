import assert from 'node:assert/strict';
import test from 'node:test';
import {decodeV3Payload, encodeV3Payload} from '../lib/cdp/v3-payload';

test('corrects one through five byte errors', () => {
  for (let count = 1; count <= 5; count++) {
    const codeword = encodeV3Payload('ABCDEFGHIJKLMNOPQRSTUVWX');
    for (let i = 0; i < count; i++) codeword[i * 3] ^= 0x5a + i;
    const decoded = decodeV3Payload(codeword);
    assert.equal(decoded.payload, 'ABCDEFGHIJKLMNOPQRSTUVWX');
    assert.equal(decoded.correctedBytes, count);
  }
});

test('corrects errors in data and parity at varied positions', () => {
  const codeword = encodeV3Payload('abc-09_ABCDEFGHIJKLMNOP');
  const positions = [0, 7, 21, 22, 27];
  positions.forEach((position, index) => { codeword[position] ^= 0x11 + index * 37; });
  const decoded = decodeV3Payload(codeword);
  assert.equal(decoded.payload, 'abc-09_ABCDEFGHIJKLMNOP');
  assert.equal(decoded.correctedBytes, positions.length);
});

test('rejects more than five byte errors', () => {
  const codeword = encodeV3Payload('ABCDEFGHIJKLMNOPQRSTUVWX');
  for (let i = 0; i < 6; i++) codeword[i * 3] ^= 0x5a + i;
  assert.throws(() => decodeV3Payload(codeword));
});
