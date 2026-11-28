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
- **Seed:** `drive seed` prints `{"seeded":[]}` (no app tables yet)
- **Sign in:** none (no accounts yet)
- **Screens:** /, /track/everyday, /track/kids, /track/nope, /lesson/everyday-a0-u1, /lesson/nope, /review (list in e2e/screens.ts, shared with the axe e2e)
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
| API health | GET /api/health | public | `server/server.test.ts` "GET /api/health answers" | - |
