import {CDP_PAYLOAD_CHARS} from './constants';

export const CDP_SEED_REGEX = /^[A-Z0-9]{12}$/;

const AES_KEY_BYTES = 32;
const AES_COUNTER_BYTES = 16;
const AES_CTR_LENGTH = 64;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const CLIENT_ENV = {
  NEXT_PUBLIC_CDP_AES_KEY_B64: process.env.NEXT_PUBLIC_CDP_AES_KEY_B64,
  NEXT_PUBLIC_CDP_AES_COUNTER_B64: process.env.NEXT_PUBLIC_CDP_AES_COUNTER_B64,
} as const;

let cachedCryptoKeyPromise: Promise<CryptoKey> | null = null;
let cachedCounterBytes: ArrayBuffer | null = null;
let cachedKeyBytes: ArrayBuffer | null = null;

function toOwnedUint8Array(bytes: ArrayLike<number>) {
  const owned = new Uint8Array(new ArrayBuffer(bytes.length));
  owned.set(bytes);
  return owned;
}

function toOwnedArrayBuffer(bytes: ArrayLike<number>) {
  return toOwnedUint8Array(bytes).buffer;
}

function getCryptoOrThrow() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto API tidak tersedia untuk enkripsi seed.');
  }
  return cryptoApi;
}

function normalizeSeedOrThrow(seed: string) {
  const normalized = seed.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(normalized)) {
    throw new Error(`Seed harus 1 sampai ${CDP_PAYLOAD_CHARS} karakter dan hanya boleh A-Z atau 0-9.`);
  }
  return normalized;
}

function normalizeSeedToFixedLength(seed: string) {
  return normalizeSeedOrThrow(seed).padEnd(CDP_PAYLOAD_CHARS, '0');
}

function decodeBase64(value: string) {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(value);
    return toOwnedArrayBuffer(Array.from(binary, (char) => char.charCodeAt(0)));
  }

  throw new Error('Base64 decoder tidak tersedia di environment ini.');
}

function readRequiredEnv(name: 'NEXT_PUBLIC_CDP_AES_KEY_B64' | 'NEXT_PUBLIC_CDP_AES_COUNTER_B64') {
  const value = CLIENT_ENV[name]?.trim();
  if (value) return value;

  throw new Error(`${name} wajib diisi di file environment agar generator siap dipakai.`);
}

function readConfiguredBytes(
  name: 'NEXT_PUBLIC_CDP_AES_KEY_B64' | 'NEXT_PUBLIC_CDP_AES_COUNTER_B64',
  expectedLength: number,
) {
  const raw = readRequiredEnv(name);
  let bytes: ArrayBuffer;

  try {
    bytes = decodeBase64(raw);
  } catch {
    throw new Error(`${name} harus berupa Base64 yang valid.`);
  }

  if (bytes.byteLength !== expectedLength) {
    throw new Error(`${name} harus menghasilkan ${expectedLength} byte, tetapi saat ini ${bytes.byteLength} byte.`);
  }

  return bytes;
}

function bytesToBinaryString(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
}

function binaryStringToBytes(value: string) {
  return toOwnedArrayBuffer(Array.from(value, (char) => char.charCodeAt(0) & 0xff));
}

function getKeyBytes() {
  if (!cachedKeyBytes) {
    cachedKeyBytes = readConfiguredBytes('NEXT_PUBLIC_CDP_AES_KEY_B64', AES_KEY_BYTES);
  }

  return cachedKeyBytes;
}

function getCounterBytes() {
  if (!cachedCounterBytes) {
    cachedCounterBytes = readConfiguredBytes('NEXT_PUBLIC_CDP_AES_COUNTER_B64', AES_COUNTER_BYTES);
  }

  return cachedCounterBytes;
}

async function importEncryptionKey() {
  if (!cachedCryptoKeyPromise) {
    const cryptoApi = getCryptoOrThrow();
    cachedCryptoKeyPromise = cryptoApi.subtle.importKey('raw', getKeyBytes(), {name: 'AES-CTR'}, false, ['encrypt', 'decrypt']);
  }

  return cachedCryptoKeyPromise;
}

/** Encrypts the 12-char plaintext seed into a 12-byte binary payload for CDP embedding. */
export async function encryptSeedToPayload(seed: string) {
  const normalizedSeed = normalizeSeedToFixedLength(seed);
  const cryptoApi = getCryptoOrThrow();
  const key = await importEncryptionKey();
  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-CTR',
      counter: getCounterBytes(),
      length: AES_CTR_LENGTH,
    },
    key,
    textEncoder.encode(normalizedSeed),
  );

  return bytesToBinaryString(new Uint8Array(ciphertext));
}

/** Decrypts a 12-byte binary payload back into its 12-char plaintext seed. */
export async function decryptPayloadToSeed(payload: string) {
  if (payload.length !== CDP_PAYLOAD_CHARS) {
    throw new Error(`Payload terenkripsi harus tepat ${CDP_PAYLOAD_CHARS} byte.`);
  }

  const cryptoApi = getCryptoOrThrow();
  const key = await importEncryptionKey();
  const plaintext = await cryptoApi.subtle.decrypt(
    {
      name: 'AES-CTR',
      counter: getCounterBytes(),
      length: AES_CTR_LENGTH,
    },
    key,
    binaryStringToBytes(payload),
  );

  const decodedSeed = textDecoder.decode(plaintext).toUpperCase();
  return normalizeSeedOrThrow(decodedSeed.replace(/0+$/g, '') || decodedSeed);
}

/** Ensures a generator settings seed always has its encrypted payload companion. */
export async function withEncryptedPayload<T extends {seed: string; payload?: string}>(settings: T): Promise<T & {payload: string}> {
  const payload = await encryptSeedToPayload(settings.seed);
  return {
    ...settings,
    payload,
  };
}

export function getEncryptionConfigSummary() {
  return {
    algorithm: 'AES-CTR',
    keyBytes: AES_KEY_BYTES,
    counterBytes: AES_COUNTER_BYTES,
    counterLengthBits: AES_CTR_LENGTH,
    keyConfigured: Boolean(CLIENT_ENV.NEXT_PUBLIC_CDP_AES_KEY_B64?.trim()),
    counterConfigured: Boolean(CLIENT_ENV.NEXT_PUBLIC_CDP_AES_COUNTER_B64?.trim()),
  };
}