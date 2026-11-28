import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { migrate } from './migrate.ts';

/** `webDir`: the exported web app, served on every non-API path. */
export type ServerConfig = { port: number; dbPath: string; webDir?: string };
export type RunningServer = { url: string; close: () => Promise<void> };

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations');

export function readConfig(env: Record<string, string | undefined>): ServerConfig {
  const config: ServerConfig = {
    port: env.PORT === undefined ? 8787 : parsePort(env.PORT),
    dbPath: env.DB_PATH || './data/dev.sqlite',
  };
  if (env.WEB_DIR) config.webDir = env.WEB_DIR;
  return config;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || port > 65535) {
    throw new Error(`PORT must be a whole number from 0 to 65535, got ${JSON.stringify(value)}`);
  }
  return port;
}

// react-native-web writes its styles into <style> tags at runtime, hence
// 'unsafe-inline' for styles only. Scripts come only from this origin.
const contentSecurityPolicy = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

function createApp(webDir: string | undefined) {
  const app = new Hono();
  app.use(secureHeaders({ xFrameOptions: 'DENY', contentSecurityPolicy }));
  app.get('/api/health', (c) => c.json({ ok: true }));
  if (webDir) serveWebApp(app, webDir);
  return app;
}

/** Static files from `webDir`; app routes without a file get index.html. */
function serveWebApp(app: Hono, webDir: string) {
  const notApi = /^\/(?!api(\/|$))/;
  const lastSegmentHasExtension = /\.[^/]+$/;
  app.get('*', async (c, next) => {
    if (!notApi.test(c.req.path)) return next();
    return serveStatic({ root: webDir })(c, next);
  });
  app.get('*', async (c, next) => {
    if (!notApi.test(c.req.path) || lastSegmentHasExtension.test(c.req.path)) return next();
    return serveStatic({ root: webDir, path: 'index.html' })(c, next);
  });
}

/** Opens and migrates the database, then listens. Port 0 picks a free port. */
export async function startServer(config: ServerConfig): Promise<RunningServer> {
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  try {
    migrate(db, MIGRATIONS_DIR);
  } catch (error) {
    db.close();
    throw error;
  }

  const server = createAdaptorServer({ fetch: createApp(config.webDir).fetch });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`Expected a TCP address, got ${JSON.stringify(address)}`);
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          db.close();
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
