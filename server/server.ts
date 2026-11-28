import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createAdaptorServer } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { readUnits } from '../src/content/files.ts';
import type { Unit } from '../src/content/schema.ts';
import { accountRoutes } from './accounts.ts';
import { migrate } from './migrate.ts';
import { profileRoutes } from './profiles.ts';
import { progressRoutes } from './progress.ts';
import { unitRoutes } from './units.ts';

/**
 * `webDir`: the exported web app, served on every non-API path.
 * `now`: the clock (tests move it); defaults to the system clock.
 * `contentDir`: the unit files; defaults to the repo's content/.
 * `signupsPerAddress`: sign-ups allowed from one client address per 15 minutes; defaults to 30 (MAX_SIGNUPS_PER_ADDRESS).
 * `hashPassword`: hashes a new account's password; defaults to scrypt (tests count its calls).
 */
export type ServerConfig = {
  port: number;
  dbPath: string;
  webDir?: string;
  now?: () => Date;
  contentDir?: string;
  signupsPerAddress?: number;
  hashPassword?: (password: string) => Promise<string>;
};
export type RunningServer = { url: string; close: () => Promise<void> };

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations');
const CONTENT_DIR = join(import.meta.dirname, '..', 'content');

export function readConfig(env: Record<string, string | undefined>): ServerConfig {
  const config: ServerConfig = {
    port: env.PORT === undefined ? 8787 : parsePort(env.PORT),
    dbPath: env.DB_PATH || './data/dev.sqlite',
  };
  if (env.WEB_DIR) config.webDir = env.WEB_DIR;
  if (env.SIGNUPS_PER_ADDRESS) config.signupsPerAddress = parseCount('SIGNUPS_PER_ADDRESS', env.SIGNUPS_PER_ADDRESS);
  return config;
}

function parseCount(name: string, value: string): number {
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`${name} must be a whole number above 0, got ${JSON.stringify(value)}`);
  return Number(value);
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

function createApp(db: DatabaseSync, config: ServerConfig, units: readonly Unit[]) {
  const app = new Hono();
  app.use(secureHeaders({ xFrameOptions: 'DENY', contentSecurityPolicy }));
  app.get('/api/health', (c) => c.json({ ok: true }));
  const now = config.now ?? (() => new Date());
  app.route('/api', accountRoutes(db, now, { signupsPerAddress: config.signupsPerAddress, hash: config.hashPassword }));
  app.route('/api', progressRoutes(db, now, units));
  app.route('/api', profileRoutes(db, now));
  app.route('/api', unitRoutes(db, now, units));
  if (config.webDir) serveWebApp(app, config.webDir);
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
  // Read first: broken content stops the server before it opens anything.
  const units = readUnits(config.contentDir ?? CONTENT_DIR);
  mkdirSync(dirname(config.dbPath), { recursive: true });
  const db = new DatabaseSync(config.dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  try {
    migrate(db, MIGRATIONS_DIR);
  } catch (error) {
    db.close();
    throw error;
  }

  const server = createAdaptorServer({ fetch: createApp(db, config, units).fetch });
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
