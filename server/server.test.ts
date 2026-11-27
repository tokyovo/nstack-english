import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
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

describe('readConfig', () => {
  test('defaults to port 8787 and ./data/dev.sqlite', () => {
    assert.deepEqual(readConfig({}), { port: 8787, dbPath: './data/dev.sqlite' });
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
