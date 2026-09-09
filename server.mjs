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

const app = next({dev, hostname, port});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const listener = (req, res) => handle(req, res);

  if (useHttps && existsSync(certPath) && existsSync(keyPath)) {
    const httpsServer = createHttpsServer(
      {
        cert: readFileSync(certPath),
        key: readFileSync(keyPath),
      },
      listener,
    );

    httpsServer.listen(port, hostname, () => {
      console.log(`Next HTTPS server running on https://${displayUrl}`);
    });
    return;
  }

  const httpServer = createHttpServer(listener);
  httpServer.listen(port, hostname, () => {
    console.log(`Next HTTP server running on http://${displayUrl}`);
  });
});
