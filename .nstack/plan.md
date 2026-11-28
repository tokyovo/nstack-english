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

## Slice: voices (branch nstack/voices)
Owner request 2026-11-28: the device text-to-speech sounds terrible. Learners hear every English word, example and exercise sentence in a natural neural voice, the same on every phone and browser, offline; the device voice is used only when a file cannot play. New and changed content cannot ship without its audio.

Acceptance criteria:
1. `npm run audio -- generate` renders every distinct English audio text in content/ (word `audio` or `en`, example `en`, every exercise text a learner hears: listen_choose audio, speak text, and any other field the player passes to speech today) with Kokoro-82M (kokoro-js, Apache-2.0, model `onnx-community/Kokoro-82M-v1.0-ONNX` at a pinned revision, cached under ~/.cache/hoc-english, never in git) to mono MP3 64 kbps at speed 0.85, two voices (US female `af_heart`, US male `am_michael`) chosen deterministically per text; it skips texts whose file is current and is idempotent (second run renders nothing).
2. `content/audio/manifest.json` (not bundled into the app) records per key: text, voice, speed, model revision, file name; files are `content/audio/<key>.mp3`, key = 16 hex chars of FNV-1a 64 over the NFC-normalised trimmed text (`src/audio/key.ts`, used by the script, the test and the app). The content test fails on a text with no manifest entry, an entry whose voice/speed/model differ from the current settings (stale), a missing file, a file not in the manifest (orphan), or a key collision.
3. `npm run audio -- check [--sample 0.1]` transcribes a random sample (seeded, printed) back with Whisper (transformers.js `onnx-community/whisper-base.en`, Apache-2.0/MIT) and compares normalised words with the text (case, punctuation, number words); exits 1 on a mismatch. The whole catalogue is checked once in this slice; each mismatch is fixed by re-rendering (other voice or the word inside a carrier text is not allowed: the file must say exactly the text) or, when Whisper itself is wrong on an isolated short word, listed with the reason in `content/audio/check-exceptions.json` (each listed key re-checked by ear is impossible here, so the list stays under 5% of keys and the review reads it).
4. The app plays the file for a text through expo-audio from a generated require map (`src/audio/files.ts`, key -> asset, covering every key, so premium units also play offline; the map holds keys only, never the English text, so `e2e/bundle.spec.ts` stays green); `playEnglish(text)` falls back to `speakEnglish` when the text has no file or playback fails; "Nghe" shows when the text has a file or the device can speak English. Jest proves file, missing-file fallback and error fallback; e2e proves pressing Nghe in a lesson loads an `.mp3` with status 200 and logs no console error.
5. `content/SOURCES.md` lists the Kokoro model and voices and the Whisper model with licences; design.md "Sources" says generated audio, device speech as fallback.

Answers for builders (plan check):
- Decision: bundle every audio file (about 590 texts, ~2.5 s each at 64 kbps, ~12 MB) instead of streaming premium audio from the server: one mechanism on all platforms, offline for premium too, keys reveal no premium text. Reversible: serve premium keys from the server later if app size matters.
- Decision: kokoro-js through Node (no pip on this machine; same model as kokoro-onnx). Install with `--onnxruntime-node-install-cuda=skip` (the CUDA binary download 404s); record that flag where `npm ci` runs (CI and README) or set it in `.npmrc`. kokoro-js and @huggingface/transformers are devDependencies: generation and checking run on a developer machine; CI only runs the content test against committed files.
- Rendering about 590 texts takes over an hour single-threaded (spike: 8-18 s per phrase on q8 CPU); run several worker processes (at most 4) and log the time.
- MP3 encoding through the system ffmpeg (present at /usr/bin/ffmpeg); the script exits with a clear message when ffmpeg is missing.

- Fresh reader's questions, answered:
  1. T39 adds a small "Nghe" for the word card's example sentence too (examples are rendered and played).
  2. Voice = lowest bit of the key: even `af_heart`, odd `am_michael`; a word and its example are chosen independently.
  3. `npm run audio -- generate` also writes `src/audio/files.ts`; a Jest test fails when it disagrees with the manifest (like the content manifest test).
  4. Red-first tests run on `src/content/__fixtures__` (a tiny manifest and a few tiny committed mp3s); the real catalogue is checked by the same function in the content test.
  5. Stale = any of voice (from the rule), speed, model revision, bitrate or sample rate differs from the script's current settings, all stored per entry.
  6. The 5% limit counts all keys; listed keys are still transcribed and reported as "excepted" but do not fail. Equal after: lower case, punctuation removed, contractions expanded on both sides, digits 0-100 = number words, "o'clock" kept as a word.
  7. `check` uses the same limit of 4 workers; no time budget, log the time.
  8. The no-voice text path remains for texts without a file (covered in Jest); e2e specs that assert "no Nghe without a device voice" are rewritten: Nghe now shows from the file (spec change, logged).
  9. e2e: the mp3 response is 200, no console error, and the page's media element reports it started (`!paused` or a `playing` event); no faking.
  10. Yes: the speak exercise's listen wording follows "has a file or the device can speak".
  11. A second press restarts the clip; leaving the step stops it; playback stops before the recogniser starts; iOS plays in silent mode (`playsInSilentMode: true`).
  12. expo-audio is native: T39's proof rebuilds with `drive android-build` and adds taps on `listen-word`/`listen-exercise` to `.maestro/steps/answer-step.yaml`. MP3s go in plain git (~12 MB). The CUDA skip goes in `.npmrc` (`onnxruntime-node-install-cuda=skip`).

- [ ] T38 Generated audio for every text, manifest, content test, transcription check. Proof: `npm test` (content test red first on a missing file, a stale entry and an orphan), `npm run audio -- generate` twice (second renders 0), `npm run audio -- check --sample 1` exit 0. Content: yes. Needs: none
- [ ] T39 Play generated audio with device speech as fallback. Proof: Jest (file, no file, error), `npm run e2e` (mp3 200 on Nghe), Android flow taps Nghe on the emulator without a crash. Platforms: web, Android. Needs: T38

Later slices (from the backlog, in order): colour (owner's taste redesign, planned after the design-bar research), habit (Học tiếp on home and a fair daily goal/streak, score 9), polish (score-8 items: focus outlines, profiles focus, self-check wording, "12" scoring, kids type_answer), pronunciation drills (score 8).



## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
- review-speak: T11-T15, PR #3
- content-a1 + content-a2: T26-T32, PR #4
- accounts-sync: T16-T19b, PR #5
- family: T20-T22b, PR #6
- plans: T23-T25b, PR #7
