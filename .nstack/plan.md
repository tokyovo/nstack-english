# Plan

## Slice: learn-core (branch nstack/learn-core)
A learner with no account opens the app, picks a track (Đời sống, Công việc, Trẻ em), sees the units of that track by level, opens a lesson, meets each new word on a card and hears it spoken, answers the lesson's exercises with immediate Vietnamese feedback, and finishes on a result screen. Completed lessons and answers stay after the app is closed and opened again. No energy, hearts or per-day limits (research need 4). Every unit from A1 carries a short Vietnamese usage note (research need 3).

Acceptance criteria:
1. Content lives in `content/<track>/<level>/u<n>.json`, validated by a schema in `src/content/schema.ts`; `npm test` includes the content test from `../content` rule 2 (schema, translations, audio text, duplicate ids, answer among options, at least 6 words and 10 exercises per unit, words used only from their unit or earlier, `source` listed in `content/SOURCES.md`), proved failing on a broken fixture.
2. Units written and native-reader checked: everyday A0 u1-u5, work A0 u1-u3, kids A0 u1-u5 (kids words carry a picture emoji).
3. `/` shows the three tracks; `/track/<track>` lists levels and units with completion state; `/lesson/<unitId>` plays the lesson; the result screen shows correct count and the next step. All text from `vi.ts`. e2e: a learner completes everyday A0 u1 on web, reloads, and sees it completed.
4. Listening: each word card and `listen_choose` item has a "Nghe" button that speaks the English with `expo-speech` (en-US); when speech is unavailable the button is hidden and the text is shown (Jest proves both paths).
5. Exercises `choose_meaning`, `choose_english`, `listen_choose`, `build_sentence`, `type_answer` work by touch and keyboard; wrong answers show the right answer in Vietnamese feedback; `type_answer` accepts listed variants, ignoring case, extra spaces and final punctuation (unit tests).
6. Progress: a local store (`@react-native-async-storage/async-storage`) keeps per-profile lesson completion and per-item answer history, versioned for later sync; Jest proves save/load and a schema version bump. Android Maestro flow `.maestro/lesson.yaml` completes a lesson, restarts the app, sees it completed (runs when KVM is available; parked otherwise).
7. Screens pass the design critique and axe at 390 and 1280 px, light and dark.

- [x] T5 Content schema, loader, content test and SOURCES.md, with everyday A0 u1 as the first unit. Proof: `npm test` (content test seen failing on a broken fixture), native reader verdict. Content: yes. Needs: foundation
- [x] T6 Track and unit screens (`/`, `/track/<track>`) reading the content index, completion state from the progress store. Proof: Jest screen tests, e2e `e2e/tracks.spec.ts`, axe. Access: public. Needs: T5, T7
- [x] T7 Progress store (local, versioned, per profile id "local"). Proof: Jest `src/progress/*.test.ts`. Needs: foundation
- [x] T8 Lesson player: word cards with speech, the five exercise types, feedback, result screen, saving to the progress store. Proof: Jest per exercise, e2e `e2e/lesson.spec.ts` (complete, reload, completed), Maestro `.maestro/lesson.yaml` (Android, parked without KVM). Access: public. Needs: T5, T7. Note: a build_sentence can have more than one correct order (e.g. "My name is Lan" / "Lan is my name"): add an optional `accepted` list of alternative orders to build_sentence in the schema and accept any of them.
- [x] T9 Content: everyday A0 u2-u5. Proof: content test, native reader verdict. Content: yes. Needs: T5
- [x] T10 Content: work A0 u1-u3 and kids A0 u1-u5. Proof: content test, native reader verdict. Content: yes. Needs: T5

Later slices (in order, planned in full when reached): accounts-sync (sign up, sign in, sync progress across devices), family (parent account, child profiles, parent gate, per-child progress), plans (free/premium entitlements, server-served premium lessons, payments parked), content-a1, content-a2.

## Slice: review-speak (branch nstack/review-speak)
Words a learner has met come back for review on a spaced schedule: a word answered wrongly comes back sooner, a word answered right waits longer. Home shows how many words are due; "Ôn tập" runs a short review session built from those words. Lessons and reviews include speaking: on devices with speech recognition the learner taps the microphone and says the phrase; elsewhere (or if the microphone is refused) they listen, repeat aloud and mark themselves.

Design: the schedule is a pure function of data the progress store already keeps (lesson completion times and timestamped answers keyed by word id), so it needs no new stored state and syncs for free later. Leitner boxes with intervals 10 min, 1 d, 3 d, 7 d, 16 d, 35 d: a word enters box 1 when its unit is first completed; a right answer moves it up one box, a wrong one back to box 1 (due in 10 min). Considered SM-2/FSRS: more tuning, harder to explain and test; Leitner is enough for A0-A2 and can be swapped behind the same function. Speech recognition through `expo-speech-recognition` (MIT; iOS, Android, Web Speech API), compared forgivingly: lowercase, strip punctuation, expand common contractions, pass when word-level similarity >= 0.8 (research need 5: unfair scoring).

Acceptance criteria:
1. `src/review/schedule.ts` unit tests: a word answered wrongly is due before the same word answered rightly; intervals follow the boxes; a word from an uncompleted unit is never due; the clock is injected.
2. Home shows "Ôn tập" with the due count (or "Chưa có từ cần ôn" with a hint to finish a lesson); `/review` runs up to 20 due words with choose_meaning, listen_choose and type_answer generated from learned words (distractors only from learned words of the same track), records answers under word ids, and ends on a result screen; e2e: complete a lesson, set the clock forward a day, review, see the count drop.
3. A `speak` exercise type exists in the content schema and the lesson player; units u1-u5 of everyday, u1-u3 of work and u1-u5 of kids each gain 2 speak items, native-reader checked; the content test covers them.
4. Speaking: the microphone permission is asked only after the learner taps "Nói" and sees why; recognised speech is scored by the forgiving comparison (unit tests with near-miss cases such as "I am fine thank you" vs "I'm fine, thank you."); unsupported or denied falls back to listen-repeat-self-check (Jest proves both paths; web e2e covers the fallback since headless Chromium has no recognition).
5. Android: Maestro flow `.maestro/review.yaml` (runs when KVM is available; parked otherwise).

- [ ] T11 Spaced-repetition schedule and due queue from the progress store. Proof: Jest `src/review/schedule.test.ts` (seen failing). Needs: none
- [ ] T12 Review screen and home due count. Proof: Jest, e2e `e2e/review.spec.ts`, axe via e2e/screens.ts. Access: public. Needs: T11
- [ ] T13 Speak exercise: schema type, recognition module with forgiving scoring, permission explanation, fallback, in the lesson player. Proof: Jest `src/speech/*.test.ts`, lesson Jest, e2e fallback step. Needs: none
- [ ] T14 Content: 2 speak items per existing unit. Proof: content test, native reader verdict. Content: yes. Needs: T13 (schema)
- [ ] T15 Speak in review sessions (one speak item per session when supported). Proof: Jest. Needs: T12, T13

## Done
- foundation: T1-T4, PR #1
