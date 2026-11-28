# Verify
| Check | Speed | Command | Last result |
|---|---|---|---|
| typecheck | fast | npm run typecheck | pass (2026-11-28, 15ad710) |
| lint | fast | npm run lint | pass, 0 warnings (2026-11-28, 15ad710) |
| unit | fast | npm test | pass, 30 tests (2026-11-28, 15ad710) |
| server | fast | npm run test:server | pass, 21 tests (2026-11-28, 15ad710) |
| drive | fast | npm run test:drive | pass, 6 tests (2026-11-28, 15ad710) |
| e2e | full | npm run e2e | pass, 3 tests (2026-11-28, 15ad710) |
| drive check | full | npm run drive -- check | pass, 4 screenshots (2026-11-28, 15ad710) |
| android | full | npm run drive -- android-build && npm run drive -- android-test | build pass (1371 s first run); flows not run: no KVM (needs-human.md) |

## Drive
How an agent runs and uses the app on its own, without touching anyone's data.
- **Tool:** `npm run drive -- <command>`; `npm run drive -- --help` lists start, seed, screens, check, stop, android-build, android-start, android-test, android-stop
- **Start:** `drive start --json` re-exports dist/ when src/, assets/, app.json or package files changed, starts server/main.ts (API + dist/) on a free 127.0.0.1 port with a temporary database under /tmp, prints `{"url","db","pid"}`; reuses a healthy running instance (state in .drive/)
- **Seed:** `drive seed` creates demo@hocenglish.test (Premium for 365 days through server/grant.ts) with child "Bé Na"; prints `{"seeded":["account demo@hocenglish.test","child profile Bé Na","premium demo@hocenglish.test"]}`; a second run seeds nothing new
- **Sign in:** demo@hocenglish.test / hoc-english-demo on /account (temporary drive database only); API: POST /api/auth/signin, then `Authorization: Bearer <token>`
- **Screens:** /, /track/everyday, /track/kids, /track/nope, /lesson/everyday-a0-u1, /lesson/nope, /account, /profiles, /review, /premium (list in e2e/screens.ts, shared with the axe e2e)
- **Evidence:** `drive screens <dir>` (every screen at 1280 and 390 px, light and dark; exits 1 on console errors, page errors or failed same-origin requests)
- **Health:** `drive check` starts its own instance, seeds, screenshots every screen, stops, deletes the database; exit 0 means this section is true
- **Clean up:** `drive stop [--dry-run]` stops the recorded pid (checked to be server/main.ts) and deletes the temporary database
- **Android:** `drive android-build` (expo prebuild + gradlew assembleRelease, 1371 s first run, 4 ABIs), `android-start` (exits 2 without KVM), `android-test [flow]` (adb install -r + Maestro), `android-stop`

## Features
| Feature | Reach | Access | Proof | Deny proof |
|---|---|---|---|---|
| Choose a track | / | public | `e2e/tracks.spec.ts` "a learner picks a track and sees its units by level" | - |
| Units of a track with completion | /track/<track> | public | `e2e/tracks.spec.ts` "a completed lesson shows as completed after a reload" | - |
| Take a lesson (words, listening, exercises, result) | /lesson/<unitId> | public | `e2e/lesson.spec.ts` "a learner completes everyday A0 u1, reloads, and sees it completed" | - |
| Leave a lesson keeping answers | /lesson/<unitId>, Rời bài học | public | `e2e/lesson.spec.ts` "a learner leaves mid-lesson for the track list and keeps the answers given" | - |
| Progress saved on the device | (all lesson screens) | public | `src/progress/progress-store.test.ts` "keeps a completed lesson after the app is closed and opened again" | - |
| Lesson content checked | content/ | public | `src/content/content.test.ts` "passes the cross-unit checks with the sources listed in SOURCES.md" | - |
| Review due words (spaced repetition) | /, Ôn tập ngay; /review | public | `e2e/review.spec.ts` "a learner reviews the words of a lesson a day later and sees the due count drop"; `src/review/schedule.test.ts` "brings a word answered wrongly back before the same word answered rightly" | - |
| Speaking practice with fallback | /lesson/<unitId>, speak step | public | `e2e/lesson.spec.ts` "a speak exercise falls back to self-check where the browser has no recogniser"; `src/speech/score.test.ts` | - |
| Sign up | /account; POST /api/auth/signup | public | `e2e/account.spec.ts` "a learner creates an account, stays signed in after a reload, and signs out" | - |
| Sign in (rate limited) | /account; POST /api/auth/signin | public | `server/accounts.test.ts` "after 10 failures for an email, even the right password answers 429" | - |
| Account (me) | GET /api/me | signed-in | `server/accounts.test.ts` "the token signs the new user in for GET /api/me" | `server/accounts.test.ts` "a malformed Authorization header answers 401" |
| Sign out (saves, then clears the device) | /account, Đăng xuất | signed-in | `e2e/sync.spec.ts` "after A signs out on a shared device, B signs in and has none of A lessons" | `server/accounts.test.ts` "signed out answers 401" |
| Sync progress across devices | (automatic when signed in); GET/PUT /api/profiles/:id/progress | owner of profile | `e2e/sync.spec.ts` "a lesson completed on one device shows as completed after signing in on another" | `server/progress.test.ts` "another user's profile answers 404 and changes nothing" |
| Offline notice | (root layout, signed in) | public | `e2e/sync.spec.ts` "a signed-in learner offline is told progress will sync later" | - |
| Family profiles: add, rename, delete a child | /profiles; POST/PATCH/DELETE /api/profiles | owner | `e2e/profiles.spec.ts` "a parent adds, renames and deletes a child profile" | `server/profiles.test.ts` "another user's child answers 404 and changes nothing" |
| Parent view of each child's progress | /profiles | owner | `e2e/profiles.spec.ts` "a parent sees each learner with lessons finished and words due" | `e2e/profiles.spec.ts` "a signed-out visitor is asked to sign in" |
| Child mode with its own progress | /profiles, Cho bé học -> / | child | `e2e/child-mode.spec.ts` "a parent hands the device to a child, the child learns, and the gate returns it to the parent" | `server/profiles.test.ts` "a child's token gets 404 for the owner's and a sibling's progress, and changes neither" |
| Parent gate on account and profiles | /account, /profiles while a child is active | owner | `e2e/child-mode.spec.ts` "/profiles is behind the parent gate while a child is learning" | `server/profiles.test.ts` "a child's token is refused with 403 by the account and profile endpoints, which change nothing" |
| Sign out on a family device | /account, Đăng xuất | owner | `e2e/child-mode.spec.ts` "a parent with a child learning signs out; the next sign-in on the device finds neither" | `server/profiles.test.ts` "signed out answers 401" |
| Premium units locked for free learners | /track/<track>, Bài 4+ -> /premium | public | `e2e/premium.spec.ts` "a free learner sees units 4 and 5 locked as Premium, and opening one shows what Premium is" | - |
| Premium lessons, offline after first open | /lesson/<premium id>; GET /api/units/:id | premium | `e2e/premium.spec.ts` "the Premium demo account finishes a premium lesson, then opens it again offline" | `server/units.test.ts` "a free user answers 403 without the unit" |
| /premium behind the parent gate | /premium while a child is active | owner | `e2e/premium.spec.ts` "while a child of the Premium account learns, premium units open but /premium is behind the parent gate" | `src/__tests__/premium.test.tsx` "is behind the parent gate while a child is learning, and shows after the right answer" |
| Plan for any session (child follows parent) | GET /api/plan | signed-in | `server/entitlements.test.ts` "a child's token reads its parent's plan" | `server/entitlements.test.ts` "GET /api/plan signed out answers 401" |
| Grant Premium (operator CLI, no HTTP route) | npm run grant -- --db <path> <email> <days> | operator | `server/entitlements.test.ts` "npm run grant" | `server/entitlements.test.ts` "refuses to run without an explicit --db" |
| API health | GET /api/health | public | `server/server.test.ts` "GET /api/health answers" | - |
