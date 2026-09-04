const DEFAULT_DB_USER = 'ryan';
const DEFAULT_DB_HOST = 'localhost';
const DEFAULT_DB_PORT = '5432';
const DEFAULT_DB_NAME = 'dotvera_v3';
const DEFAULT_SOURCE_DB_NAME = 'dotvera_v2';
export const LOCKED_QR_GENERATE_API_URL = 'https://authenticity-qr.pstlocal.net/api/Checking/qrcode-generate-dynamic';

function readEnv(name: string, fallback = '') {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function getDotveraDatabaseName() {
  return readEnv('DOTVERA_DB_NAME', DEFAULT_DB_NAME);
}

export function getDotveraSourceDatabaseName() {
  return readEnv('DOTVERA_SOURCE_DB_NAME', DEFAULT_SOURCE_DB_NAME);
}

export function getDotveraDatabaseConfig(databaseName = getDotveraDatabaseName()) {
  return {
    user: readEnv('DOTVERA_DB_USER', readEnv('DB_USER', DEFAULT_DB_USER)),
    password: readEnv('DOTVERA_DB_PASSWORD', readEnv('DB_PASSWORD')),
    host: readEnv('DOTVERA_DB_HOST', readEnv('DB_HOST', DEFAULT_DB_HOST)),
    port: parseInt(readEnv('DOTVERA_DB_PORT', readEnv('DB_PORT', DEFAULT_DB_PORT)), 10),
    database: databaseName,
  };
}

export function buildPostgresUrl(config: ReturnType<typeof getDotveraDatabaseConfig>) {
  const user = encodeURIComponent(config.user);
  const password = config.password ? `:${encodeURIComponent(config.password)}` : '';
  return `postgresql://${user}${password}@${config.host}:${config.port}/${encodeURIComponent(config.database)}`;
}

export function getDotveraDatabaseUrl() {
  return readEnv('DATABASE_URL', buildPostgresUrl(getDotveraDatabaseConfig()));
}

export function getQrGenerateApiUrl() {
  return readEnv('QR_GENERATE_API_URL', LOCKED_QR_GENERATE_API_URL);
}
