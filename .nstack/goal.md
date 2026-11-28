# Goal
A commercial English-learning app for Vietnamese speakers who know no English, built as one Expo (React Native) codebase that runs as an iPhone app, an Android app and a web version. Three tracks: everyday English for adult beginners, English for work, and kids (child profiles owned by a parent account). Levels from zero (pre-A1) to A2 first. The whole interface and every explanation is in Vietnamese. Lessons teach vocabulary and phrases with listening (high-quality audio generated at build time by an open neural voice for all existing and future content, with device text-to-speech only as the fallback when a file cannot play), speaking practice where the device supports speech recognition, and review with spaced repetition. Progress is saved on the device, and synced across devices for signed-in users. A free plan and a premium subscription share one entitlement model; store and card payments are left for a person to connect. Content is written originally or taken from commercially licensed open data.

## Owner's taste
The app must be colourful and visually attractive, like the most beautiful apps in the world: a full palette with a colour per track, drawn colour icons, a picture on every concrete word, depth (layered surfaces) and celebratory feedback (a correct answer animates and sounds, a finished lesson celebrates). The design bar is set by research walkthroughs of the leading language-learning apps, and every screen is redesigned to it.

## Done when
- The same codebase builds and runs on Android (emulator AVD nstack35), and on the web; iOS builds from the same config (not run here: no macOS).
- Every screen shows Vietnamese text only (English appears only as the content being taught), checked by a test that fails on untranslated UI strings.
- A learner with no account can pick a track (everyday, work, kids), take lessons from level 0 to A2, hear each word and phrase spoken, answer exercises, and see their progress after the app restarts.
- Speaking practice works where the device supports speech recognition and is hidden or replaced by a listen-and-repeat fallback where it does not.
- Review uses spaced repetition: items answered wrongly come back sooner, a test proves the schedule.
- A signed-in user's progress made on one device appears on another device (proved by an API test and a two-client e2e test).
- A parent account can create, rename and delete child profiles; each child has separate progress; a child profile cannot reach account or purchase settings.
- Free and premium plans: an entitlement model decides which lessons are locked; premium can be granted by a server-side record (payments themselves not connected); tests prove free users are refused premium lessons by the server.
- Every lesson item has a recorded source and licence (original or commercially licensed open data), checked by a content test.
- Every word and sentence has a generated audio file (open neural voice with a commercial-use licence, more than one voice); the app plays the file and falls back to device speech only when it cannot; a content test fails on a missing or stale file, and a sample is transcribed back and matches.
- Every screen meets the owner's taste: one colour per track, drawn colour icons (no typed emoji), a picture on every concrete word, layered surfaces and celebratory feedback, checked by screenshot critique at 1280 and 390 px.
- The Android flows (Maestro) pass on the emulator AVD nstack35.

## Out of scope
- Publishing to the App Store, Google Play or any production host.
- Connecting real store (StoreKit / Play Billing) or card payments: parked for a person.
- Levels above A2 (later).
- Recorded human audio (generated neural voices instead).

## Policy
- merge: auto     # auto: merge your own PR when CI and review pass. pr: leave it open for a person.
- branch: main    # the default branch
- evolve: yes     # yes: once "Done when" holds, keep improving, including new features research supports. no: only fix and harden.
- bar: 8          # score (value + risk + cost, 3-15) an improvement needs to become a ticket. Lower means more improvements.
