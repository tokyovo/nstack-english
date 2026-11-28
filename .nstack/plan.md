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

- [ ] T5 Content schema, loader, content test and SOURCES.md, with everyday A0 u1 as the first unit. Proof: `npm test` (content test seen failing on a broken fixture), native reader verdict. Content: yes. Needs: foundation
- [ ] T6 Track and unit screens (`/`, `/track/<track>`) reading the content index, completion state from the progress store. Proof: Jest screen tests, e2e `e2e/tracks.spec.ts`, axe. Access: public. Needs: T5, T7
- [ ] T7 Progress store (local, versioned, per profile id "local"). Proof: Jest `src/progress/*.test.ts`. Needs: foundation
- [ ] T8 Lesson player: word cards with speech, the five exercise types, feedback, result screen, saving to the progress store. Proof: Jest per exercise, e2e `e2e/lesson.spec.ts` (complete, reload, completed), Maestro `.maestro/lesson.yaml` (Android, parked without KVM). Access: public. Needs: T5, T7
- [ ] T9 Content: everyday A0 u2-u5. Proof: content test, native reader verdict. Content: yes. Needs: T5
- [ ] T10 Content: work A0 u1-u3 and kids A0 u1-u5. Proof: content test, native reader verdict. Content: yes. Needs: T5

Later slices (in order, planned in full when reached): review-speak (spaced repetition review, speaking practice), accounts-sync (sign up, sign in, sync progress across devices), family (parent account, child profiles, parent gate, per-child progress), plans (free/premium entitlements, server-served premium lessons, payments parked), content-a1, content-a2.

## Done
- foundation: T1-T4, PR #1
