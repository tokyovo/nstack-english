# Plan

## Slice: foundation (branch nstack/foundation)
Nothing a learner can use yet: the project gains its verification harness, so every later slice can be proven. The app opens to a Vietnamese welcome screen styled to `design.md`; a local API server answers health checks; an agent can start, seed, screenshot and stop the whole app with one tool; CI runs every check, and builds iOS on a macOS runner.

Architecture (decided here, see log): Expo SDK 58 app in `src/` (Expo Router, `web.output: "single"` static export); API server in `server/` written in TypeScript run directly by Node 24 (type stripping), Hono + @hono/node-server, SQLite through the built-in `node:sqlite`, tests with `node --test`. In drive and CI the server also serves the exported web app from `dist/`, so the web app and the API share one origin. The native apps reach the API through `EXPO_PUBLIC_API_URL`.

Acceptance criteria:
1. `npm run typecheck`, `npm run lint` (0 warnings) and `npm test` (Jest, jest-expo preset) pass; the template's example screens and components are gone.
2. Every user-visible string in `src/` comes from `src/i18n/vi.ts` through `t()`: `npm test` includes a test that fails on a JSX text literal or a literal `accessibilityLabel`, `placeholder`, `title` or `alt` prop in `src/**/*.tsx` (proved by seeing it fail on a planted literal).
3. The welcome screen (`/`) shows the app name and a Vietnamese tagline using the tokens and Be Vietnam Pro font from `design.md`, with the ô-ly grid signature, in light and dark themes.
4. `npm run test:server` passes: `GET /api/health` returns `{"ok":true}`; the database is created and migrated idempotently from `server/migrations/*.sql` (running the migrator twice leaves the same schema).
5. `npm run drive -- --help` lists start, seed, screens, check, stop, android-build, android-start, android-test, android-stop; `drive check` exits 0 (starts on a free port with a temporary database, seeds, screenshots every screen at 1280 and 390 px with no console errors, stops, deletes the database).
6. `npm run e2e` (Playwright against the drive server) passes, including an axe scan of every screen with no serious or critical violations.
7. `.github/workflows/ci.yml` runs lint, typecheck, Jest, server tests and e2e on ubuntu, and an iOS job on macOS that prebuilds and builds for the simulator with `xcodebuild`.

Out of scope: lessons, accounts, sync, payments (later slices).

Answers for builders (from the plan check):
- Names: app name "Học Tiếng Anh" in Vietnamese UI, English working name "Hoc English"; slug `hoc-english`; scheme `hocenglish`; bundle id / package `app.hocenglish`; iOS Xcode workspace/scheme follow from prebuild (`HocTiengAnh` or whatever prebuild generates; CI reads it from `ios/*.xcworkspace`). Tagline (vi): "Học tiếng Anh từ con số không, mỗi ngày một chút." Replace template splash/icon colours with `design.md` background/accent; delete `scripts/reset-project.js` and unused template assets/components.
- Screens: a single list `e2e/screens.ts` (path + name) is the one source for `drive screens`, `drive check` and the axe e2e; each new screen adds a row there. For now just `/`. Screenshots and axe run in light and dark (`colorScheme` emulation in Playwright).
- UI-string test (`src/i18n/ui-strings.test.ts`): parse with the TypeScript compiler API (`typescript` is already a dependency); fail on JsxText with any letter, string literal or no-substitution template literal directly inside a JSX expression container in children, and string literals in props `accessibilityLabel`, `accessibilityHint`, `placeholder`, `title`, `alt`, `aria-label`, `label`. Text that is only punctuation, digits or whitespace is allowed. A committed fixture (`src/i18n/__fixtures__/planted.tsx.txt`) proves the checker reports a planted literal.
- `t()`: flat key map typed from `vi.ts` (`t(key: MessageKey, vars?: Record<string, string | number>)`, `{name}` interpolation). Vietnamese is the only language now; the structure allows adding one.
- Android in T3: the four `android-*` subcommands are real (gradle assembleRelease after `expo prebuild`, emulator start headless with `-accel` per `../mobile`, adb install + Maestro, stop by adb emu kill). When `/dev/kvm` is not writable, `android-start` exits 2 with "KVM not available: see .nstack/needs-human.md". Proof here: `--help` plus that message; `android-build` should be run once and its time recorded if it builds without the emulator.
- Seed: T2 adds no app tables; `drive seed` runs, prints `{"seeded":[]}` and exits 0. Later slices fill it.
- Server config: `PORT` (default 8787), `DB_PATH` (default `./data/dev.sqlite`, gitignored; drive uses a temp file), `WEB_DIR` (optional, serve static export with SPA fallback to index.html). App: `EXPO_PUBLIC_API_URL`, unset on web means same-origin relative `/api`.
- Migrator: table `schema_migrations(name TEXT PRIMARY KEY, checksum TEXT, applied_at TEXT)`, files sorted by name, each in one transaction, edited applied migration (checksum mismatch) is an error.
- iOS CI: `macos-latest`, default Xcode, `npx expo prebuild --platform ios`, `pod install`, `xcodebuild -workspace ... -scheme ... -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build`. Non-blocking (`continue-on-error: true`) until it has passed once; parked if the runner is unavailable.
- Grid: drawn with Views (no new dependency): 16 px cells, `line` colour at 50% opacity, inside the word card only.
- Fonts: `@expo-google-fonts/be-vietnam-pro` weights 400/600/700, splash held until loaded (or failed: then system font).
- Console errors in `drive check`: `console.error`, `pageerror` and failed requests to the app's own origin count; warnings and favicon do not. axe tags: wcag2a, wcag2aa, wcag21aa; fail on serious or critical.
- Lint and typecheck cover `src/`, `server/`, `scripts/` and `e2e/` with `--max-warnings 0`; server tsconfig uses `allowImportingTsExtensions`, `erasableSyntaxOnly`, `noEmit`. Jest ignores `server/`, `e2e/`, `.claude/`, `dist/`.

- [ ] T1 Clean template, tokens, font, i18n and the UI-string test; Vietnamese welcome screen. Proof: `npm run typecheck && npm run lint && npm test` (string test seen failing on a planted literal). Needs: none
- [ ] T2 API server skeleton: Hono app, `node:sqlite` with an idempotent migrator, `/api/health`, `node --test` tests. Proof: `npm run test:server`. Access: public (health). Needs: none. Migration: yes
- [ ] T3 Drive tool and Playwright e2e with axe: `scripts/drive.mjs` (start/seed/screens/check/stop plus android-* subcommands), server serves `dist/`. Proof: `npm run drive -- check`, `npm run e2e`. Needs: T1, T2
- [ ] T4 CI workflow (ubuntu checks plus macOS iOS simulator build). Proof: the workflow run on the PR. Needs: T3

## Done
