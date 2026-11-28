# Plan

Later slices (in order, planned in full when reached): plans (free/premium entitlements, server-served premium lessons, payments parked), content-a1, content-a2.

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
- learn-core: T5-T10, PR #2
