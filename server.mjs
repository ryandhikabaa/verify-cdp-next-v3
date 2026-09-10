import 'dotenv/config';
import {createServer as createHttpServer} from 'node:http';
import {createServer as createHttpsServer} from 'node:https';
import {readFileSync, existsSync} from 'node:fs';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = Number(process.env.PORT || 3004);
const displayUrl = `localhost:${port}`;
const useHttps = process.env.HTTPS === 'true';
const certPath = './certs/localhost-cert.pem';
const keyPath = './certs/localhost-key.pem';

// Validate configuration at startup
if (!dev) {
  const DATABASE_URL = process.env.DATABASE_URL;
  const AUTH_SECRET = process.env.AUTH_SECRET;
  
  if (!DATABASE_URL || !DATABASE_URL.startsWith('postgresql://')) {
    console.error('[CONFIG ERROR] DATABASE_URL must be a valid PostgreSQL connection string');
    process.exit(1);
  }
  
  if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
    console.error('[CONFIG ERROR] AUTH_SECRET must be at least 32 characters long');
    process.exit(1);
  }
  
  console.log('[CONFIG] Configuration validated successfully');
}

const app = next({dev, hostname, port});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const listener = (req, res) => handle(req, res);

  let server;
  if (useHttps && existsSync(certPath) && existsSync(keyPath)) {
    server = createHttpsServer(
      {
        cert: readFileSync(certPath),
        key: readFileSync(keyPath),
      },
      listener,
    );

    server.listen(port, hostname, () => {
      console.log(`Next HTTPS server running on https://${displayUrl}`);
    });
  } else {
    server = createHttpServer(listener);
    server.listen(port, hostname, () => {
      console.log(`Next HTTP server running on http://${displayUrl}`);
    });
  }

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`[SHUTDOWN] Received ${signal}, shutting down gracefully...`);
    try {
      const {prisma} = await import('./lib/db/prisma.js');
      await prisma.$disconnect();
      console.log('[SHUTDOWN] Database disconnected');
    } catch (err) {
      console.error('[SHUTDOWN] Error disconnecting database:', err);
    }
    server.close(() => {
      console.log('[SHUTDOWN] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});
