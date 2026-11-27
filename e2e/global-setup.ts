import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const drive = join(import.meta.dirname, '..', 'scripts', 'drive.mjs');

/**
 * Starts the app through the drive tool with its own state dir, so a
 * developer's running instance is never reused or stopped, and hands its URL
 * to the workers as E2E_BASE_URL. The returned function stops it again.
 */
export default function globalSetup() {
  const stateDir = mkdtempSync(join(tmpdir(), 'e2e-drive-'));
  const env = { ...process.env, DRIVE_STATE_DIR: stateDir };
  const started = execFileSync(process.execPath, [drive, 'start', '--json'], { env, encoding: 'utf8' });
  process.env.E2E_BASE_URL = (JSON.parse(started) as { url: string }).url;

  return () => {
    execFileSync(process.execPath, [drive, 'stop'], { env, stdio: 'inherit' });
    rmSync(stateDir, { recursive: true, force: true });
  };
}
