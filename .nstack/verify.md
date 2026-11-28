# Verify
| Check | Speed | Command | Last result |
|---|---|---|---|
| typecheck | fast | npm run typecheck | pass (2026-11-27, 7a7a873) |
| lint | fast | npm run lint | pass, 0 warnings (2026-11-27, 7a7a873) |
| unit | fast | npm test | pass, 15 tests (2026-11-27, 7a7a873) |
| server | fast | npm run test:server | pass, 21 tests (2026-11-27, 7a7a873) |
| drive | fast | npm run test:drive | pass, 5 tests (2026-11-27, 7a7a873) |
| e2e | full | npm run e2e | pass, 3 tests (2026-11-27, 7a7a873) |
| drive check | full | npm run drive -- check | pass, 4 screenshots (2026-11-27, 7a7a873) |
| android | full | npm run drive -- android-build && npm run drive -- android-test | build pass (1371 s first run); flows not run: no KVM (needs-human.md) |

## Drive
How an agent runs and uses the app on its own, without touching anyone's data.
- **Tool:** `npm run drive -- <command>`; `npm run drive -- --help` lists start, seed, screens, check, stop, android-build, android-start, android-test, android-stop
- **Start:** `drive start --json` re-exports dist/ when src/, assets/, app.json or package files changed, starts server/main.ts (API + dist/) on a free 127.0.0.1 port with a temporary database under /tmp, prints `{"url","db","pid"}`; reuses a healthy running instance (state in .drive/)
- **Seed:** `drive seed` creates the demo account (prints `{"seeded":["account demo@hocenglish.test"]}`; a second run counts the 409 as already seeded)
- **Sign in:** demo@hocenglish.test / hoc-english-demo on /account (temporary drive database only); API: POST /api/auth/signin, then `Authorization: Bearer <token>`
- **Screens:** /, /account (list in e2e/screens.ts, shared with the axe e2e)
- **Evidence:** `drive screens <dir>` (every screen at 1280 and 390 px, light and dark; exits 1 on console errors, page errors or failed same-origin requests)
- **Health:** `drive check` starts its own instance, seeds, screenshots every screen, stops, deletes the database; exit 0 means this section is true
- **Clean up:** `drive stop [--dry-run]` stops the recorded pid (checked to be server/main.ts) and deletes the temporary database
- **Android:** `drive android-build` (expo prebuild + gradlew assembleRelease, 1371 s first run, 4 ABIs), `android-start` (exits 2 without KVM), `android-test [flow]` (adb install -r + Maestro), `android-stop`

## Features
| Feature | Reach | Access | Proof | Deny proof |
|---|---|---|---|---|
| Welcome screen | / | public | `e2e/welcome.spec.ts` | - |
| Sign up | /account; POST /api/auth/signup | public | `e2e/account.spec.ts` "a learner creates an account, stays signed in after a reload, and signs out" | - |
| Sign in (rate limited) | /account; POST /api/auth/signin | public | `server/accounts.test.ts` "after 10 failures for an email, even the right password answers 429" | - |
| Account (me) | GET /api/me | signed-in | `server/accounts.test.ts` "the token signs the new user in for GET /api/me" | `server/accounts.test.ts` "a malformed Authorization header answers 401" |
| Sign out (saves, then clears the device) | /account, Đăng xuất | signed-in | `e2e/sync.spec.ts` "after A signs out on a shared device, B signs in and has none of A lessons" | `server/accounts.test.ts` "signed out answers 401" |
| Sync progress across devices | (automatic when signed in); GET/PUT /api/profiles/:id/progress | owner of profile | `e2e/sync.spec.ts` "a lesson completed on one device shows as completed after signing in on another" | `server/progress.test.ts` "another user's profile answers 404 and changes nothing" |
| Offline notice | (root layout, signed in) | signed-in | `e2e/sync.spec.ts` "a signed-in learner offline is told progress will sync later" | - |
| API health | GET /api/health | public | `server/server.test.ts` "GET /api/health answers" | - |
