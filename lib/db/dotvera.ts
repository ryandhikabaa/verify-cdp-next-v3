import 'dotenv/config';
import {randomUUID, scryptSync, timingSafeEqual} from 'node:crypto';
import {Pool} from 'pg';
import {getDotveraDatabaseConfig} from '@/lib/db/env';

let dotveraPool: Pool | null = null;

const DOTVERA_IMAGE_PREFIX = 'data:image/png;base64,';
const DOTVERA_BINARY_TEXT_PREFIX = 'base64:';

/** Returns a dedicated PostgreSQL pool for leftover raw queries. App auth/users use Prisma. */
export function getDotveraPool() {
  if (!dotveraPool) {
    const config = getDotveraDatabaseConfig();
    dotveraPool = new Pool({
      user: config.user,
      host: config.host,
      database: config.database,
      password: config.password,
      port: config.port,
    });
  }

  return dotveraPool;
}

/** V3.1 schema is owned by Prisma. Runtime CREATE/ALTER is a no-op. */
export async function ensureDotveraSchema() {
  return;
}

/** Converts a PNG data URL into a binary buffer. */
export function dotveraImageDataToBuffer(imageData: unknown) {
  if (typeof imageData !== 'string' || !imageData.startsWith(DOTVERA_IMAGE_PREFIX)) {
    return null;
  }

  return Buffer.from(imageData.slice(DOTVERA_IMAGE_PREFIX.length), 'base64');
}

/** Encodes binary-string payloads so PostgreSQL text columns never receive NUL bytes. */
export function encodeDotveraBinaryText(value: unknown) {
  if (typeof value !== 'string') return value;
  return `${DOTVERA_BINARY_TEXT_PREFIX}${Buffer.from(value, 'latin1').toString('base64')}`;
}

/** Restores payloads encoded for storage while keeping legacy plain-text rows readable. */
export function decodeDotveraBinaryText(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith(DOTVERA_BINARY_TEXT_PREFIX)) return value;
  return Buffer.from(value.slice(DOTVERA_BINARY_TEXT_PREFIX.length), 'base64').toString('latin1');
}

/** Creates an application-level password hash using scrypt. */
export function hashPassword(password: string) {
  const salt = randomUUID();
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/** Verifies a plain password against a stored scrypt hash. */
export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const incoming = scryptSync(password, salt, 64);
  const existing = Buffer.from(hash, 'hex');

  return existing.length === incoming.length && timingSafeEqual(existing, incoming);
}
