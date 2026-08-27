const V3_VERSION = 1;
const MAX_PAYLOAD_LENGTH = 24;
const DATA_BYTES = 22;
const PARITY_BYTES = 10;
const CODEWORD_BYTES = DATA_BYTES + PARITY_BYTES;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
import {reedSolomonDecode, reedSolomonEncode} from './v3-reed-solomon';

export type V3PayloadCodeword = Uint8Array;
export type V3DecodedPayload = {payload: string; length: number; correctedBytes: number};

function fail(message: string): never { throw new Error(`V3 payload: ${message}`); }

export function validateV3Payload(payload: string): string {
  if (typeof payload !== 'string') fail('payload harus berupa string.');
  if (payload.length > MAX_PAYLOAD_LENGTH) fail(`payload maksimal ${MAX_PAYLOAD_LENGTH} karakter.`);
  for (const char of payload) if (!ALPHABET.includes(char)) fail(`karakter payload tidak valid: ${JSON.stringify(char)}.`);
  return payload;
}

function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const value of bytes) {
    crc ^= value << 8;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function toDataBytes(payload: string): Uint8Array {
  const data = new Uint8Array(DATA_BYTES); data[0] = V3_VERSION; data[1] = payload.length;
  let bitOffset = 16;
  for (let i = 0; i < payload.length; i++) {
    const value = ALPHABET.indexOf(payload[i]);
    for (let bit = 5; bit >= 0; bit--, bitOffset++) {
      if ((value >> bit) & 1) data[Math.floor(bitOffset / 8)] |= 1 << (7 - (bitOffset % 8));
    }
  }
  const checksum = crc16(data.subarray(0, 20)); data[20] = checksum >>> 8; data[21] = checksum & 0xff; return data;
}

export function encodeV3Payload(payload: string): V3PayloadCodeword { return reedSolomonEncode(toDataBytes(validateV3Payload(payload))); }

export function decodeV3Payload(codeword: Uint8Array): V3DecodedPayload {
  if (!(codeword instanceof Uint8Array) || codeword.length !== CODEWORD_BYTES) fail(`codeword harus tepat ${CODEWORD_BYTES} byte.`);
  let correctedBytes: number;
  let corrected: Uint8Array;
  try { ({codeword: corrected, correctedBytes} = reedSolomonDecode(codeword)); } catch (error) { fail(error instanceof Error ? error.message : 'Reed–Solomon correction gagal.'); }
  const data = corrected.subarray(0, DATA_BYTES); if (data[0] !== V3_VERSION) fail('versi payload tidak didukung.');
  const length = data[1]; if (length > MAX_PAYLOAD_LENGTH) fail('panjang payload tidak valid.');
  const expected = (data[20] << 8) | data[21]; if (crc16(data.subarray(0, 20)) !== expected) fail('CRC-16 tidak valid.');
  let payload = ''; let bitOffset = 16;
  for (let i = 0; i < length; i++) {
    let value = 0;
    for (let bit = 0; bit < 6; bit++, bitOffset++) value = (value << 1) | ((data[Math.floor(bitOffset / 8)] >> (7 - (bitOffset % 8))) & 1);
    if (value >= ALPHABET.length) fail('payload alphabet index tidak valid.');
    payload += ALPHABET[value];
  }
  for (; bitOffset < 160; bitOffset++) {
    if ((data[Math.floor(bitOffset / 8)] & (1 << (7 - (bitOffset % 8)))) !== 0) fail('padding payload tidak nol.');
  }
  return {payload, length, correctedBytes};
}

export const V3_PAYLOAD_CONSTANTS = {V3_VERSION, MAX_PAYLOAD_LENGTH, DATA_BYTES, PARITY_BYTES, CODEWORD_BYTES, ALPHABET} as const;
