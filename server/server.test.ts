import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';

import { readConfig, startServer, type RunningServer } from './server.ts';

describe('API server', () => {
  let dir: string;
  let dbPath: string;
  let server: RunningServer;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'server-test-'));
    dbPath = join(dir, 'nested', 'app.sqlite');
    server = await startServer({ port: 0, dbPath });
  });

  after(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('GET /api/health answers {"ok":true}', async () => {
    const response = await fetch(`${server.url}/api/health`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    assert.equal(await response.text(), '{"ok":true}');
  });

  test('responses carry nosniff and frame-ancestors headers', async () => {
    const response = await fetch(`${server.url}/api/health`);

    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  });

  test('creates the database file and migrates it on start', () => {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const table = db
        .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'schema_migrations'")
        .get();
      assert.equal(table?.name, 'schema_migrations');
    } finally {
      db.close();
    }
  });

  test('unknown API paths answer 404', async () => {
    const response = await fetch(`${server.url}/api/nope`);

    assert.equal(response.status, 404);
  });
});

describe('API server with WEB_DIR', () => {
  let dir: string;
  let server: RunningServer;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), 'server-web-test-'));
    const webDir = join(dir, 'dist');
    mkdirSync(join(webDir, '_expo'), { recursive: true });
    writeFileSync(join(webDir, 'index.html'), '<!doctype html><title>app shell</title>');
    writeFileSync(join(webDir, '_expo', 'entry.js'), 'console.log("entry")');
    writeFileSync(join(dir, 'secret.txt'), 'outside the web dir');
    server = await startServer({ port: 0, dbPath: join(dir, 'app.sqlite'), webDir });
  });

  after(async () => {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  test('GET / serves the exported index.html', async () => {
    const response = await fetch(`${server.url}/`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(await response.text(), '<!doctype html><title>app shell</title>');
  });

  test('serves files from the web dir', async () => {
    const response = await fetch(`${server.url}/_expo/entry.js`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /javascript/);
    assert.equal(await response.text(), 'console.log("entry")');
  });

  test('an app route with no file falls back to index.html', async () => {
    const response = await fetch(`${server.url}/track/everyday`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<!doctype html><title>app shell</title>');
  });

  test('a missing file with an extension answers 404, not the app shell', async () => {
    const response = await fetch(`${server.url}/_expo/missing.js`);

    assert.equal(response.status, 404);
  });

  test('unknown API paths still answer 404', async () => {
    const response = await fetch(`${server.url}/api/nope`);

    assert.equal(response.status, 404);
  });

  test('never serves a file outside the web dir', async () => {
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt']) {
      const body = await rawGet(server.url, path);
      assert.doesNotMatch(body, /outside the web dir/, path);
    }
  });

  test('pages carry a CSP that allows only same-origin scripts and no framing', async () => {
    const csp = (await fetch(`${server.url}/`)).headers.get('content-security-policy') ?? '';

    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
  });
});

/** GET with the path sent exactly as written (fetch would normalise `..`). */
function rawGet(baseUrl: string, path: string): Promise<string> {
  const { hostname, port } = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = request({ hostname, port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('readConfig', () => {
  test('defaults to port 8787 and ./data/dev.sqlite', () => {
    assert.deepEqual(readConfig({}), { port: 8787, dbPath: './data/dev.sqlite' });
  });

  test('reads WEB_DIR when set', () => {
    assert.deepEqual(readConfig({ WEB_DIR: 'dist' }), {
      port: 8787,
      dbPath: './data/dev.sqlite',
      webDir: 'dist',
    });
  });

  test('reads PORT and DB_PATH from the environment', () => {
    assert.deepEqual(readConfig({ PORT: '9000', DB_PATH: '/tmp/x.sqlite' }), {
      port: 9000,
      dbPath: '/tmp/x.sqlite',
    });
  });

  test('rejects a PORT that is not a port number', () => {
    for (const PORT of ['abc', '-1', '70000', '80.5', '']) {
      assert.throws(() => readConfig({ PORT }), /PORT/, `PORT=${JSON.stringify(PORT)}`);
    }
  });
});
