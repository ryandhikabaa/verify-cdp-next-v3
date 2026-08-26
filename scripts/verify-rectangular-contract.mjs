import assert from 'node:assert/strict';

const ROWS = 64;
const COLUMNS = 32;
const TOTAL_BITS = 112;
const MASK_X = 12.9898;
const MASK_Y = 78.233;
const MASK_Z = 43758.5453;
const PAYLOAD_CHARS = 12;

function maskBit(x, y) {
  const value = Math.sin(x * MASK_X + y * MASK_Y) * MASK_Z;
  return value - Math.floor(value) > 0.5 ? 1 : 0;
}

function encode(text) {
  const value = text.slice(0, PAYLOAD_CHARS).padEnd(PAYLOAD_CHARS, ' ');
  const bits = [];
  let checksum = 0;
  for (const char of value) {
    const code = char.charCodeAt(0);
    checksum = (checksum + code) * 31 % 65536;
    for (let bit = 7; bit >= 0; bit--) bits.push((code >> bit) & 1);
  }
  for (let bit = 15; bit >= 0; bit--) bits.push((checksum >> bit) & 1);
  return bits;
}

function generate(payload) {
  const data = encode(payload);
  return Array.from({length: ROWS}, (_, y) => Array.from({length: COLUMNS}, (_, x) => {
    const index = (x * 73 + y * 19 + (x * y % 17)) % TOTAL_BITS;
    return data[index] ^ maskBit(x + 11, y + 7);
  }));
}

function decode(cells) {
  const votes = new Int32Array(TOTAL_BITS);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLUMNS; x++) {
    const index = (x * 73 + y * 19 + (x * y % 17)) % TOTAL_BITS;
    const raw = cells[y][x] ^ maskBit(x + 11, y + 7);
    votes[index] += raw ? 1 : -1;
  }
  const bits = Array.from(votes, (vote) => vote > 0 ? 1 : 0);
  let text = '';
  let checksum = 0;
  for (let i = 0; i < PAYLOAD_CHARS; i++) {
    let code = 0;
    for (let bit = 0; bit < 8; bit++) code = (code << 1) | bits[i * 8 + bit];
    checksum = (checksum + code) * 31 % 65536;
    text += String.fromCharCode(code);
  }
  let stored = 0;
  for (let bit = 0; bit < 16; bit++) stored = (stored << 1) | bits[96 + bit];
  return {text: text.trim(), isValid: checksum === stored};
}

const left = 'LEFT1234567';
const right = 'RIGHT765432';
const leftMatrix = generate(left);
const rightMatrix = generate(right);
assert.deepEqual(decode(leftMatrix), {text: left, isValid: true});
assert.deepEqual(decode(rightMatrix), {text: right, isValid: true});
assert.notDeepEqual(leftMatrix, rightMatrix, 'left and right matrices must differ');
assert.deepEqual(generate(left), leftMatrix, 'generation must be deterministic');
assert.equal(leftMatrix.length, ROWS);
assert.equal(leftMatrix.every((row) => row.length === COLUMNS), true);
console.log('Rectangular contract OK');
console.log({left: decode(leftMatrix), right: decode(rightMatrix), dimensions: `${COLUMNS}x${ROWS}`});
