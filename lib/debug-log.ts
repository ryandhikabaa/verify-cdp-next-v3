import {appendFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

const DEBUG_LOG_DIR = path.join(process.cwd(), 'logs');
const DEBUG_LOG_FILE = path.join(DEBUG_LOG_DIR, 'api-debug.log');

function timestamp() {
  return new Date().toISOString();
}

/**
 * Appends a line to the API debug log file (logs/api-debug.log) so operators
 * can inspect exactly what was sent to and received from the QR API. Failures
 * are swallowed so logging can never break the request path.
 */
export async function writeDebugLog(entry: Record<string, unknown>) {
  try {
    await mkdir(DEBUG_LOG_DIR, {recursive: true});
    const line = `[${timestamp()}] ${JSON.stringify(entry)}\n`;
    await appendFile(DEBUG_LOG_FILE, line, 'utf8');
  } catch {
    // Logging is best-effort only.
  }
}
