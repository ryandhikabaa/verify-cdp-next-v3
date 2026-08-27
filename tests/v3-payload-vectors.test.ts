import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {decodeV3Payload, encodeV3Payload} from '../lib/cdp/v3-payload';

type Fixture = {payload: string; codewordHex: string};
const fixture = JSON.parse(readFileSync(new URL('../docs/v3-payload-test-vectors.json', import.meta.url), 'utf8')) as {vectors: Fixture[]};

function hex(bytes: Uint8Array) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
function bytes(value: string) { return Uint8Array.from(value.match(/.{2}/g)?.map(pair => parseInt(pair, 16)) ?? []); }

test('V3 fixtures match deterministic codewords', () => {
  for (const vector of fixture.vectors) {
    const encoded = encodeV3Payload(vector.payload);
    assert.equal(hex(encoded), vector.codewordHex, vector.payload);
    assert.equal(decodeV3Payload(bytes(vector.codewordHex)).payload, vector.payload);
  }
});
