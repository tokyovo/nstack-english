#!/usr/bin/env node
// @ts-check
// The agent interface to the app: start it on a free port with a temporary
// database, seed it, screenshot every screen, stop it; build and drive the
// Android app. `npm run drive -- --help` lists the commands.
import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { screens } from '../e2e/screens.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const STATE_DIR = resolve(process.env.DRIVE_STATE_DIR || join(ROOT, '.drive'));
const STATE_FILE = join(STATE_DIR, 'state.json');
const ANDROID_STATE_FILE = join(STATE_DIR, 'android.json');
const ANDROID_HOME = process.env.ANDROID_HOME || join(homedir(), 'Android', 'sdk');
const ADB = join(ANDROID_HOME, 'platform-tools', 'adb');
const EMULATOR = join(ANDROID_HOME, 'emulator', 'emulator');
const AVD = process.env.DRIVE_AVD || 'nstack35';
const MAESTRO = process.env.MAESTRO || join(homedir(), '.maestro', 'bin', 'maestro');
const APK = join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const WIDTHS = [1280, 390];
const SCHEMES = /** @type {const} */ (['light', 'dark']);

class UsageError extends Error {
  /** @param {string} message @param {number} [exitCode] */
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

/** @typedef {{ url: string, db: string, pid: number }} Instance */

const commands = {
  start: {
    usage: 'start [--json] [--no-build]',
    summary: 'export the web app if sources changed, start it on a free port with a temporary database',
    run: commandStart,
  },
  seed: {
    usage: 'seed',
    summary: 'fill the running app\'s database with demo data; prints {"seeded": [...]}',
    run: commandSeed,
  },
  screens: {
    usage: 'screens [dir] [--json]',
    summary: 'screenshot every screen at 1280 and 390 px, light and dark; exits 1 on console errors',
    run: commandScreens,
  },
  check: {
    usage: 'check',
    summary: 'start, seed, screenshot every screen, stop and delete the database; exit 0 means the app works',
    run: commandCheck,
  },
  stop: {
    usage: 'stop [--dry-run]',
    summary: 'stop the app started by `start` and delete its temporary database',
    run: commandStop,
  },
  'android-build': {
    usage: 'android-build',
    summary: 'expo prebuild, then gradle assembleRelease (JS bundled, no dev server needed)',
    run: commandAndroidBuild,
  },
  'android-start': {
    usage: 'android-start [--json]',
    summary: `boot the emulator (AVD ${AVD}) headless; exits 2 when KVM is not available`,
    run: commandAndroidStart,
  },
  'android-test': {
    usage: 'android-test [flow]',
    summary: 'install the release APK and run a Maestro flow (default: every flow in .maestro/)',
    run: commandAndroidTest,
  },
  'android-stop': {
    usage: 'android-stop',
    summary: 'shut down the emulator started by android-start',
    run: commandAndroidStop,
  },
};

function help() {
  const width = Math.max(...Object.keys(commands).map((name) => name.length));
  const lines = Object.entries(commands).map(([name, c]) => `  ${name.padEnd(width)} ${c.summary}`);
  return [
    'Usage: npm run drive -- <command> [options]',
    '',
    'Commands:',
    ...lines,
    '',
    'Run `npm run drive -- <command> --help` for one command.',
    'State (pid, url, temporary database) lives in .drive/ (DRIVE_STATE_DIR overrides).',
  ].join('\n');
}

// ---------- web app ----------

/** @param {string[]} args */
async function commandStart(args) {
  const running = await runningInstance();
  const instance = running ?? (await startInstance({ build: !args.includes('--no-build') }));
  if (!running) writeJson(STATE_FILE, instance);
  if (args.includes('--json')) print(JSON.stringify(instance));
  else print(`${running ? 'Already running' : 'Started'}: ${instance.url} (database ${instance.db}, pid ${instance.pid})`);
}

async function commandSeed() {
  const instance = await requireInstance();
  print(JSON.stringify({ seeded: await seedInstance(instance) }));
}

/** @param {string[]} args */
async function commandScreens(args) {
  const instance = await requireInstance();
  const dir = resolve(args.find((a) => !a.startsWith('--')) ?? mkdtempSync(join(tmpdir(), 'drive-screens-')));
  const result = await takeScreens(instance.url, dir);
  report(result, args.includes('--json'));
  if (result.errors.length > 0) process.exitCode = 1;
}

async function commandCheck() {
  const instance = await startInstance({ build: true });
  const dir = mkdtempSync(join(tmpdir(), 'drive-check-'));
  try {
    print(`Started ${instance.url} (database ${instance.db})`);
    print(`Seeded: ${JSON.stringify(await seedInstance(instance))}`);
    const result = await takeScreens(instance.url, dir);
    report(result, false);
    if (result.errors.length > 0) throw new UsageError(`check failed: ${result.errors.length} console error(s), see above`);
  } finally {
    await stopInstance(instance);
    rmSync(dir, { recursive: true, force: true });
    print(`Stopped; deleted ${instance.db}`);
  }
  print('check passed');
}

/** @param {string[]} args */
async function commandStop(args) {
  const instance = readJson(STATE_FILE);
  if (!instance) return print('Nothing running.');
  if (args.includes('--dry-run')) {
    return print(`Would stop pid ${instance.pid} (${instance.url}) and delete ${instance.db}`);
  }
  await stopInstance(instance);
  rmSync(STATE_FILE, { force: true });
  print(`Stopped pid ${instance.pid}; deleted ${instance.db}`);
}

/** @param {{ build: boolean }} options @returns {Promise<Instance>} */
async function startInstance({ build }) {
  if (build) buildIfNeeded();
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new UsageError('dist/index.html is missing: run `npm run drive -- start` without --no-build');
  }
  const dbDir = mkdtempSync(join(tmpdir(), 'hoc-english-drive-'));
  const db = join(dbDir, 'app.sqlite');
  const log = join(dbDir, 'server.log');
  const port = await freePort();
  const out = openSync(log, 'a');
  const child = spawn(process.execPath, [join(ROOT, 'server', 'main.ts')], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, PORT: String(port), DB_PATH: db, WEB_DIR: DIST },
  });
  child.unref();
  if (child.pid === undefined) throw new UsageError('could not start the server process');
  const instance = { url: `http://127.0.0.1:${port}`, db, pid: child.pid };

  for (let waited = 0; waited < 20_000; waited += 100) {
    if (child.exitCode !== null) break;
    if (await isHealthy(instance.url)) return instance;
    await sleep(100);
  }
  await stopInstance(instance);
  throw new UsageError(`the server did not answer /api/health; its log:\n${readFileSync(log, 'utf8')}`);
}

/** The demo learner `drive seed` creates; a throwaway account in a temporary database. */
const DEMO_ACCOUNT = { email: 'demo@hocenglish.test', password: 'hoc-english-demo' };

/**
 * Seeds demo data through the app's own API and returns what was seeded.
 * Seeding again is fine: an existing demo account (409) counts as seeded.
 * @param {Instance} instance @returns {Promise<string[]>}
 */
async function seedInstance(instance) {
  const response = await fetch(`${instance.url}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(DEMO_ACCOUNT),
  });
  if (response.status !== 201 && response.status !== 409) {
    throw new UsageError(`seeding the demo account failed: ${response.status} ${await response.text()}`);
  }
  return [`account ${DEMO_ACCOUNT.email}`];
}

/** @param {Instance} instance */
async function stopInstance(instance) {
  if (isOurServer(instance.pid)) {
    process.kill(instance.pid, 'SIGTERM');
    for (let waited = 0; isAlive(instance.pid) && waited < 5_000; waited += 100) await sleep(100);
    if (isAlive(instance.pid)) process.kill(instance.pid, 'SIGKILL');
  }
  rmSync(join(instance.db, '..'), { recursive: true, force: true });
}

/** The instance in the state file, if it is still up; a dead one is cleaned up. */
async function runningInstance() {
  const instance = readJson(STATE_FILE);
  if (!instance) return null;
  if (isOurServer(instance.pid) && (await isHealthy(instance.url))) return instance;
  await stopInstance(instance);
  rmSync(STATE_FILE, { force: true });
  return null;
}

async function requireInstance() {
  const instance = await runningInstance();
  if (!instance) throw new UsageError('The app is not running: run `npm run drive -- start` first.');
  return instance;
}

/** Re-exports the web app when anything it is built from is newer than dist/. */
function buildIfNeeded() {
  const built = join(DIST, 'index.html');
  const builtAt = existsSync(built) ? statSync(built).mtimeMs : 0;
  const sources = ['src', 'assets', 'app.json', 'package.json', 'package-lock.json'].map((p) => join(ROOT, p));
  if (builtAt > 0 && sources.every((source) => newestMtime(source) < builtAt)) return;
  process.stderr.write('Exporting the web app to dist/ ...\n');
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (result.status !== 0) throw new UsageError('`expo export --platform web` failed; see the output above');
}

/** @param {string} path @returns {number} */
function newestMtime(path) {
  if (!existsSync(path)) return 0;
  const stats = statSync(path);
  if (!stats.isDirectory()) return stats.mtimeMs;
  return Math.max(
    stats.mtimeMs,
    ...readdirSync(path)
      .filter((name) => !name.startsWith('.'))
      .map((name) => newestMtime(join(path, name))),
  );
}

/**
 * Loads every screen at each width and colour scheme, saves a full-page
 * screenshot, and collects console errors, page errors and failed requests to
 * the app's own origin (warnings and the favicon do not count).
 * @param {string} url @param {string} dir
 */
async function takeScreens(url, dir) {
  const { chromium } = await import('@playwright/test');
  mkdirSync(dir, { recursive: true });
  const origin = new URL(url).origin;
  /** @type {string[]} */ const files = [];
  /** @type {string[]} */ const errors = [];
  const browser = await chromium.launch();
  try {
    for (const screen of screens) {
      for (const width of WIDTHS) {
        for (const colorScheme of SCHEMES) {
          const label = `${screen.path} ${width}px ${colorScheme}`;
          const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 800 }, colorScheme });
          const page = await context.newPage();
          page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: console.error: ${m.text()}`));
          page.on('pageerror', (e) => errors.push(`${label}: page error: ${e.message}`));
          const ownRequest = (/** @type {string} */ u) => u.startsWith(origin) && !u.endsWith('/favicon.ico');
          page.on('requestfailed', (r) => ownRequest(r.url()) && errors.push(`${label}: request failed: ${r.url()}`));
          page.on('response', (r) => ownRequest(r.url()) && r.status() >= 400 && errors.push(`${label}: ${r.status()} ${r.url()}`));
          await page.goto(url + screen.path, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const file = join(dir, `${screen.name}-${width}-${colorScheme}.png`);
          await page.screenshot({ path: file, fullPage: true });
          files.push(file);
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return { dir, files, errors };
}

/** @param {{ dir: string, files: string[], errors: string[] }} result @param {boolean} json */
function report(result, json) {
  if (json) return print(JSON.stringify(result));
  print(`${result.files.length} screenshots in ${result.dir}`);
  for (const error of result.errors) process.stderr.write(`error: ${error}\n`);
}

// ---------- Android ----------

async function commandAndroidBuild() {
  const started = Date.now();
  const env = { ...process.env, ANDROID_HOME };
  run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], { cwd: ROOT, env });
  run('./gradlew', ['assembleRelease'], { cwd: join(ROOT, 'android'), env });
  print(`Built ${APK} in ${Math.round((Date.now() - started) / 1000)} s`);
}

/** @param {string[]} args */
async function commandAndroidStart(args) {
  const kvm = process.env.KVM_DEVICE || '/dev/kvm';
  const direct = isWritable(kvm);
  const viaGroup = !direct && existsSync(kvm) && inGroup('kvm');
  if (!direct && !viaGroup) throw new UsageError('KVM not available: see .nstack/needs-human.md', 2);

  const existing = readJson(ANDROID_STATE_FILE);
  if (existing && bootCompleted(existing.serial)) {
    if (args.includes('--json')) print(JSON.stringify(existing));
    else print(`Already running: ${existing.serial}`);
    return;
  }

  const port = await freeEmulatorPort();
  const serial = `emulator-${port}`;
  const emulatorArgs = ['-avd', AVD, '-port', String(port), '-no-window', '-no-audio', '-no-boot-anim', '-gpu', 'swiftshader_indirect', '-no-snapshot-save', '-accel', 'on'];
  mkdirSync(STATE_DIR, { recursive: true });
  const out = openSync(join(STATE_DIR, 'emulator.log'), 'a');
  const quoted = [EMULATOR, ...emulatorArgs].map((a) => `'${a}'`).join(' ');
  const child = direct
    ? spawn(EMULATOR, emulatorArgs, { detached: true, stdio: ['ignore', out, out] })
    : spawn('sg', ['kvm', '-c', quoted], { detached: true, stdio: ['ignore', out, out] });
  child.unref();
  writeJson(ANDROID_STATE_FILE, { serial, pid: child.pid });

  for (let waited = 0; waited < 300_000; waited += 2_000) {
    if (bootCompleted(serial)) {
      if (args.includes('--json')) print(JSON.stringify({ serial, pid: child.pid }));
      else print(`Booted ${serial}`);
      return;
    }
    await sleep(2_000);
  }
  throw new UsageError(`${serial} did not boot in 5 minutes; see ${join(STATE_DIR, 'emulator.log')}, then run android-stop`);
}

/** @param {string[]} args */
async function commandAndroidTest(args) {
  const state = readJson(ANDROID_STATE_FILE);
  if (!state || !bootCompleted(state.serial)) {
    throw new UsageError('No emulator is running: run `npm run drive -- android-start` first.');
  }
  if (!existsSync(APK)) throw new UsageError('No release APK: run `npm run drive -- android-build` first.');
  const flow = args.find((a) => !a.startsWith('--')) ?? join(ROOT, '.maestro');
  if (!existsSync(flow)) throw new UsageError(`No Maestro flow at ${flow}: add flows under .maestro/`);
  run(ADB, ['-s', state.serial, 'install', '-r', APK]);
  run(MAESTRO, ['--device', state.serial, 'test', flow], { env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1' } });
}

async function commandAndroidStop() {
  const state = readJson(ANDROID_STATE_FILE);
  if (!state) return print('No emulator was started by drive.');
  spawnSync(ADB, ['-s', state.serial, 'emu', 'kill'], { stdio: 'ignore' });
  rmSync(ANDROID_STATE_FILE, { force: true });
  print(`Stopped ${state.serial}`);
}

/** @param {string} serial */
function bootCompleted(serial) {
  const result = spawnSync(ADB, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim() === '1';
}

/** The first console port pair (port, port + 1) from 5554 that nothing uses. */
async function freeEmulatorPort() {
  for (let port = 5554; port <= 5584; port += 2) {
    if ((await canListen(port)) && (await canListen(port + 1))) return port;
  }
  throw new UsageError('No free emulator port between 5554 and 5585: run android-stop or adb emu kill');
}

// ---------- helpers ----------

/** @returns {Promise<number>} */
function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

/** @param {number} port @returns {Promise<boolean>} */
function canListen(port) {
  return new Promise((resolveListen) => {
    const server = createServer();
    server.once('error', () => resolveListen(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolveListen(true)));
  });
}

/** @param {string} url */
async function isHealthy(url) {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  } catch {
    return false;
  }
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

/** Alive and running server/main.ts, so a reused pid is never killed. @param {number} pid */
function isOurServer(pid) {
  if (!isAlive(pid)) return false;
  // `ps -o command=` prints the full command line on Linux and macOS alike.
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.includes(join(ROOT, 'server', 'main.ts'));
}

/** @param {string} path */
function isWritable(path) {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** @param {string} group */
function inGroup(group) {
  const result = spawnSync('id', ['-Gn'], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.split(/\s+/).includes(group);
}

/** @param {string} command @param {string[]} args @param {import('node:child_process').SpawnSyncOptions} [options] */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new UsageError(`\`${command} ${args.join(' ')}\` failed (exit ${result.status ?? result.signal})`);
}

/** @param {string} path */
function readJson(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

/** @param {string} path @param {unknown} value */
function writeJson(path, value) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** @param {string} line */
function print(line) {
  process.stdout.write(`${line}\n`);
}

/** @param {string[]} argv */
async function main(argv) {
  const [name, ...args] = argv;
  if (name === undefined || name === '--help' || name === '-h' || name === 'help') return print(help());
  if (!Object.hasOwn(commands, name)) {
    throw new UsageError(`Unknown command "${name}". Run \`npm run drive -- --help\` for the list.`);
  }
  const command = commands[/** @type {keyof typeof commands} */ (name)];
  if (args.includes('--help')) return print(`Usage: npm run drive -- ${command.usage}\n  ${command.summary}`);
  await command.run(args);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof UsageError)) throw error;
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error.exitCode;
}
