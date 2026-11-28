import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const drive = join(import.meta.dirname, '..', 'scripts', 'drive.mjs');

/**
 * Starts the app through the drive tool with its own state dir, so a
 * developer's running instance is never reused or stopped, and hands its URL
 * to the workers as E2E_BASE_URL, and seeds it. The returned function stops it again.
 */
export default function globalSetup() {
  const stateDir = mkdtempSync(join(tmpdir(), 'e2e-drive-'));
  // Every spec signs up from 127.0.0.1, more than the 5 sign-ups per address a real client gets.
  const env = { ...process.env, DRIVE_STATE_DIR: stateDir, SIGNUPS_PER_ADDRESS: '1000' };
  const started = execFileSync(process.execPath, [drive, 'start', '--json'], { env, encoding: 'utf8' });
  process.env.E2E_BASE_URL = (JSON.parse(started) as { url: string }).url;
  // The demo account with its child, granted Premium (premium.spec.ts signs in with it).
  execFileSync(process.execPath, [drive, 'seed'], { env, stdio: 'ignore' });

  return () => {
    execFileSync(process.execPath, [drive, 'stop'], { env, stdio: 'inherit' });
    rmSync(stateDir, { recursive: true, force: true });
  };
}
