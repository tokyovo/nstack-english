// @ts-check
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

const DRIVE = join(import.meta.dirname, 'drive.mjs');

/**
 * Runs the drive tool with its state kept in `stateDir`, never the developer's.
 * @param {string} stateDir @param {string[]} args @param {Record<string, string>} [env]
 */
function drive(stateDir, args, env = {}) {
  const result = spawnSync(process.execPath, [DRIVE, ...args], {
    encoding: 'utf8',
    env: { ...process.env, DRIVE_STATE_DIR: stateDir, ...env },
    timeout: 300_000,
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** @param {number} pid */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('drive tool', () => {
  let stateDir = '';

  before(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'drive-test-'));
  });

  after(() => {
    drive(stateDir, ['stop']);
    rmSync(stateDir, { recursive: true, force: true });
  });

  test('--help lists every command', () => {
    const { code, stdout } = drive(stateDir, ['--help']);

    assert.equal(code, 0);
    for (const command of [
      'start',
      'seed',
      'screens',
      'check',
      'stop',
      'android-build',
      'android-start',
      'android-test',
      'android-stop',
    ]) {
      assert.match(stdout, new RegExp(`^  ${command} `, 'm'), command);
    }
  });

  test('an unknown command exits 1 and points to --help', () => {
    const { code, stderr } = drive(stateDir, ['launch']);

    assert.equal(code, 1);
    assert.match(stderr, /Unknown command "launch".*--help/);
  });

  test('seed without a running app exits 1 and says to start it', () => {
    const { code, stderr } = drive(stateDir, ['seed']);

    assert.equal(code, 1);
    assert.match(stderr, /drive -- start/);
  });

  test('android-start without KVM exits 2 and points to needs-human.md', () => {
    const { code, stderr } = drive(stateDir, ['android-start'], { KVM_DEVICE: join(stateDir, 'no-kvm') });

    assert.equal(code, 2);
    assert.match(stderr, /KVM not available: see \.nstack\/needs-human\.md/);
  });

  test('start, seed and stop: a temporary database, the app served, then removed', async () => {
    const started = drive(stateDir, ['start', '--json']);
    assert.equal(started.code, 0, started.stderr);
    const { url, db, pid } = JSON.parse(started.stdout);

    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.ok(db.startsWith(tmpdir()), `database ${db} is not in the temp dir`);
    assert.ok(existsSync(db));
    assert.deepEqual(await (await fetch(`${url}/api/health`)).json(), { ok: true });
    assert.match(await (await fetch(`${url}/`)).text(), /<div id="root">/);

    const again = drive(stateDir, ['start', '--json']);
    assert.equal(JSON.parse(again.stdout).pid, pid, 'a second start reuses the running app');

    const seeded = drive(stateDir, ['seed']);
    assert.equal(seeded.code, 0, seeded.stderr);
    assert.deepEqual(JSON.parse(seeded.stdout), { seeded: ['account demo@hocenglish.test'] });
    const signIn = await fetch(`${url}/api/auth/signin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'demo@hocenglish.test', password: 'hoc-english-demo' }),
    });
    assert.equal(signIn.status, 200, 'the seeded demo account signs in');
    const reseeded = drive(stateDir, ['seed']);
    assert.equal(reseeded.code, 0, `seeding twice is fine: ${reseeded.stderr}`);
    assert.deepEqual(JSON.parse(reseeded.stdout), { seeded: ['account demo@hocenglish.test'] });

    const dryRun = drive(stateDir, ['stop', '--dry-run']);
    assert.equal(dryRun.code, 0);
    assert.ok(isAlive(pid) && existsSync(db), '--dry-run changes nothing');

    const stopped = drive(stateDir, ['stop']);
    assert.equal(stopped.code, 0, stopped.stderr);
    assert.equal(isAlive(pid), false);
    assert.equal(existsSync(db), false);
    assert.equal(drive(stateDir, ['stop']).code, 0, 'stop with nothing running is fine');
  });
});
