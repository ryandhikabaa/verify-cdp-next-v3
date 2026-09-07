import {appendFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

const DEBUG_LOG_DIR = path.join(process.cwd(), 'logs');
const DEBUG_LOG_FILE = path.join(DEBUG_LOG_DIR, 'api-debug.log');

/**
 * Debug logging is opt-in. Set DEBUG_API_LOG=true in .env.local to write
 * entries to logs/api-debug.log; leave it unset/false to keep the file from
 * growing and consuming disk space.
 */
function isDebugLogEnabled() {
  return process.env.DEBUG_API_LOG === 'true';
}

function timestamp() {
  return new Date().toISOString();
}

/**
 * Appends a line to the API debug log file (logs/api-debug.log) so operators
 * can inspect exactly what was sent to and received from the QR API. Logging is
 * a no-op unless DEBUG_API_LOG=true. Failures are swallowed so logging can never
 * break the request path.
 */
export async function writeDebugLog(entry: Record<string, unknown>) {
  if (!isDebugLogEnabled()) return;
  try {
    await mkdir(DEBUG_LOG_DIR, {recursive: true});
    const line = `[${timestamp()}] ${JSON.stringify(entry)}\n`;
    await appendFile(DEBUG_LOG_FILE, line, 'utf8');
  } catch {
    // Logging is best-effort only.
  }
}
