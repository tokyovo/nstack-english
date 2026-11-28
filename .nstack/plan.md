# Plan

## Slice: hardening (branch nstack/hardening)
From improve 2026-11-28 (scores 9-12): daily learners are never signed out without warning; sign-up cannot be used to probe emails or burn CPU; the app ships its own icon and splash instead of Expo's; Android back never returns to a finished lesson; the native app asks for no permission and carries no dependency it does not use; secure tokens are never restored from a backup they cannot be read from; Android builds for the emulator take half the time.

Acceptance criteria:
1. A session's expiry moves forward on use (sliding 90 days, renewed at most once a day so reads stay cheap); an unused session still expires after 90 days (server tests with an injected clock).
2. Sign-up is rate-limited per email and per client address (429 after 5 per 15 min), counted before scrypt like sign-in; tests fire attempts concurrently.
3. App icon, adaptive icon, splash and favicon are original artwork made from a script in the repo (SVG source rendered to PNG), in the design.md colours; `app.json` points at them; no Expo artwork remains (test greps assets).
4. Lesson and review result screens leave with `router.replace`/dismiss so Android back from home does not reopen them (Jest on the navigation calls; Maestro flow updated).
5. Unused dependencies removed; Android manifest has no READ/WRITE_EXTERNAL_STORAGE (test reads `npx expo config --type introspect` permissions: only INTERNET, RECORD_AUDIO and what expo modules require); expo-secure-store plugin with `faceIDPermission: false` and Android backup rules excluding its store; `drive android-build` exports ANDROID_HOME and builds x86_64 only (`--all-abis` for all).

Answers for builders (plan check):
- T34 client address: the socket peer from @hono/node-server's getConnInfo; no reverse proxy exists (deployment is out of scope); a TRUST_PROXY setting can come later. Every sign-up attempt counts (any status), recorded before scrypt in a new `signup_attempts` table (migration, pruned on write like sign-in failures). The 409 email_taken stays (the plan's acceptance names it); the limit is what bounds probing.
- T33: renew with an UPDATE when the remaining life is under 89 days (no new column); child sessions slide the same way; no absolute maximum for now (logged decision).
- T35: remove a dependency only if nothing imports it and expo-router, reanimated and the web/Android builds do not need it as a peer: proof is typecheck, Jest, `drive check` (web) and `drive android-build` succeeding. Backup rules via a small local config plugin in `plugins/` that sets `android:allowBackup="false"` (simplest, covers both backup mechanisms; logged decision: progress lives on the server and the device store is a cache). Permission test in Jest reads `npx expo config --type introspect --json` once (release config): allowed set is INTERNET, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS if speech needs it, and the queries/intents expo-speech-recognition declares; anything else fails.
- T36: icon = a white "vở ô ly" square grid on the purple-ink accent #5B3FA8 with a large lowercase "a" in white Be Vietnam Pro 700 (drawn as an SVG path or text rendered by Playwright, which is already a dev dependency: no new rasteriser). Replace `ios.icon` with a 1024 PNG and delete `assets/expo.icon` and other Expo artwork.
- T37: result screens use `router.replace` for "Về danh sách bài" (track), "Học bài tiếp theo" and the /premium link; home links from results use `router.dismissTo('/')` where available, else replace. Hardware back on a result screen goes to the screen under it (the track or home), never to the finished lesson steps. Maestro: syntax check plus a back-navigation step in lesson.yaml (not run: no KVM).
- Proof of android-build time: log the measured time; `--all-abis` passes no -PreactNativeArchitectures.

- [x] T33 Sliding session expiry. Proof: `npm run test:server`. Access: signed-in. Needs: none
- [x] T34 Sign-up rate limit. Proof: `npm run test:server` (concurrent test seen failing). Access: public. Needs: none
- [ ] T35 Native config: unused deps, permissions, secure-store plugin and backup rules, android-build x86_64. Proof: config test, `npm run drive -- android-build` time logged. Needs: none
- [x] T36 Original icon, adaptive icon, splash and favicon from an SVG source and a render script. Proof: asset test, screenshots of the web favicon and splash colours. Needs: none
- [x] T37 Result screens replace instead of push. Proof: Jest, Maestro flow syntax. Needs: none

Later slices (from the backlog, in order): habit (Học tiếp on home and a fair daily goal/streak, score 9), polish (score-8 items: focus outlines, profiles focus, self-check wording, "12" scoring, kids type_answer), pronunciation drills (score 8).



## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
- review-speak: T11-T15, PR #3
- content-a1 + content-a2: T26-T32, PR #4
- accounts-sync: T16-T19b, PR #5
- family: T20-T22b, PR #6
- plans: T23-T25b, PR #7
