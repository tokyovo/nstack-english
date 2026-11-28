# Plan

## Slice: hardening (branch nstack/hardening)
From improve 2026-11-28 (scores 9-12): daily learners are never signed out without warning; sign-up cannot be used to probe emails or burn CPU; the app ships its own icon and splash instead of Expo's; Android back never returns to a finished lesson; the native app asks for no permission and carries no dependency it does not use; secure tokens are never restored from a backup they cannot be read from; Android builds for the emulator take half the time.

Acceptance criteria:
1. A session's expiry moves forward on use (sliding 90 days, renewed at most once a day so reads stay cheap); an unused session still expires after 90 days (server tests with an injected clock).
2. Sign-up is rate-limited per email and per client address (429 after 5 per 15 min), counted before scrypt like sign-in; tests fire attempts concurrently.
3. App icon, adaptive icon, splash and favicon are original artwork made from a script in the repo (SVG source rendered to PNG), in the design.md colours; `app.json` points at them; no Expo artwork remains (test greps assets).
4. Lesson and review result screens leave with `router.replace`/dismiss so Android back from home does not reopen them (Jest on the navigation calls; Maestro flow updated).
5. Unused dependencies removed; Android manifest has no READ/WRITE_EXTERNAL_STORAGE (test reads `npx expo config --type introspect` permissions: only INTERNET, RECORD_AUDIO and what expo modules require); expo-secure-store plugin with `faceIDPermission: false` and Android backup rules excluding its store; `drive android-build` exports ANDROID_HOME and builds x86_64 only (`--all-abis` for all).

- [ ] T33 Sliding session expiry. Proof: `npm run test:server`. Access: signed-in. Needs: none
- [ ] T34 Sign-up rate limit. Proof: `npm run test:server` (concurrent test seen failing). Access: public. Needs: none
- [ ] T35 Native config: unused deps, permissions, secure-store plugin and backup rules, android-build x86_64. Proof: config test, `npm run drive -- android-build` time logged. Needs: none
- [ ] T36 Original icon, adaptive icon, splash and favicon from an SVG source and a render script. Proof: asset test, screenshots of the web favicon and splash colours. Needs: none
- [ ] T37 Result screens replace instead of push. Proof: Jest, Maestro flow syntax. Needs: none

Later slices (from the backlog, in order): habit (Học tiếp on home and a fair daily goal/streak, score 9), polish (score-8 items: focus outlines, profiles focus, self-check wording, "12" scoring, kids type_answer), pronunciation drills (score 8).



## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
- review-speak: T11-T15, PR #3
- content-a1 + content-a2: T26-T32, PR #4
- accounts-sync: T16-T19b, PR #5
- family: T20-T22b, PR #6
- plans: T23-T25b, PR #7
