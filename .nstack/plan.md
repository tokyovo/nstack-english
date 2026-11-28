# Plan

Later slices (in order, planned in full when reached): family (parent account, child profiles, parent gate, per-child progress), plans (free/premium entitlements, server-served premium lessons, payments parked).

## Slice: review-speak (branch nstack/review-speak)
Words a learner has met come back for review on a spaced schedule: a word answered wrongly comes back sooner, a word answered right waits longer. Home shows how many words are due; "Ôn tập" runs a short review session built from those words. Lessons and reviews include speaking: on devices with speech recognition the learner taps the microphone and says the phrase; elsewhere (or if the microphone is refused) they listen, repeat aloud and mark themselves.

Design: the schedule is a pure function of data the progress store already keeps (lesson completion times and timestamped answers keyed by word id), so it needs no new stored state and syncs for free later. Leitner boxes with intervals 10 min, 1 d, 3 d, 7 d, 16 d, 35 d: a word enters box 1 when its unit is first completed; a right answer moves it up one box, a wrong one back to box 1 (due in 10 min). Considered SM-2/FSRS: more tuning, harder to explain and test; Leitner is enough for A0-A2 and can be swapped behind the same function. Speech recognition through `expo-speech-recognition` (MIT; iOS, Android, Web Speech API), compared forgivingly: lowercase, strip punctuation, expand common contractions, pass when word-level similarity >= 0.8 (research need 5: unfair scoring).

Acceptance criteria:
1. `src/review/schedule.ts` unit tests: a word answered wrongly is due before the same word answered rightly; intervals follow the boxes; a word from an uncompleted unit is never due; the clock is injected.
2. Home shows "Ôn tập" with the due count (or "Chưa có từ cần ôn" with a hint to finish a lesson); `/review` runs up to 20 due words with choose_meaning, listen_choose and type_answer generated from learned words (distractors only from learned words of the same track), records answers under word ids, and ends on a result screen; e2e: complete a lesson, set the clock forward a day, review, see the count drop.
3. A `speak` exercise type exists in the content schema and the lesson player; units u1-u5 of everyday, u1-u3 of work and u1-u5 of kids each gain 2 speak items, native-reader checked; the content test covers them.
4. Speaking: the microphone permission is asked only after the learner taps "Nói" and sees why; recognised speech is scored by the forgiving comparison (unit tests with near-miss cases such as "I am fine thank you" vs "I'm fine, thank you."); unsupported or denied falls back to listen-repeat-self-check (Jest proves both paths; web e2e covers the fallback since headless Chromium has no recognition).
5. Android: Maestro flow `.maestro/review.yaml` (runs when KVM is available; parked otherwise).

- [x] T11 Spaced-repetition schedule and due queue from the progress store. Proof: Jest `src/review/schedule.test.ts` (seen failing). Needs: none
- [x] T12 Review screen and home due count. Proof: Jest, e2e `e2e/review.spec.ts`, axe via e2e/screens.ts. Access: public. Needs: T11
- [x] T13 Speak exercise: schema type, recognition module with forgiving scoring, permission explanation, fallback, in the lesson player. Proof: Jest `src/speech/*.test.ts`, lesson Jest, e2e fallback step. Needs: none
- [x] T14 Content: 2 speak items per existing unit. Proof: content test, native reader verdict. Content: yes. Needs: T13 (schema)
- [x] T15 Speak in review sessions (one speak item per session when supported). Proof: Jest. Needs: T12, T13

## Slice: accounts-sync (branch nstack/accounts-sync)
A learner can create an account with email and password, sign in on another phone or the web, and find the same progress there. Learning without an account keeps working; the first sign-in on a device adds that device's progress to the account (nothing is lost, research need 2). Progress saves locally first and syncs when online; the app says when it is offline.

Design: the server keeps one progress document per profile and merges what a client sends with what it has, using one pure merge function shared by app and server (`src/progress/merge.ts`, no React Native imports; the server imports it by path). The merge is a union: lessons per unit keep the earliest first completion, latest last completion and best score; answers per item are a set of (time, correct) pairs. Union is idempotent and order-independent, so retries and two devices syncing in any order converge (principle 8); no conflict UI is needed. Considered: per-answer rows with a sync cursor (more tables and code, needed only at much larger data sizes). Auth: email + password hashed with scrypt (node:crypto), opaque random session tokens stored hashed, sent as `Authorization: Bearer` from all three apps (no cookies, so no CSRF); tokens kept in expo-secure-store on native and localStorage on web. Each user gets one `owner` profile at sign-up (child profiles come in the family slice).

Acceptance criteria:
1. `POST /api/auth/signup`, `/signin`, `/signout`, `GET /api/me`: server tests for success, duplicate email (409), wrong password (401, same message as unknown email), weak password (400, min 8 chars), signed-out `/api/me` (401), and sign-in rate limiting (429 after 10 failures per email per 15 min).
2. `GET` and `PUT /api/profiles/:id/progress`: PUT merges and returns the merged document; another user's profile answers 404; signed-out answers 401 (deny proofs). Merge unit tests: idempotent, commutative, keeps the best of each lesson, unions answers.
3. `/account` screen: sign up, sign in, sign out, Vietnamese errors next to the field that caused them, typed input kept after an error. Home shows the account state.
4. Sync: on sign-in the device's local progress is merged into the account; lesson and review answers push after saving; the app pulls on start and on focus; offline shows "Đang ngoại tuyến, tiến độ sẽ được đồng bộ sau". e2e with two browser contexts: A signs up and completes everyday A0 u1; B signs in and sees it completed.
5. Migrations are repeatable (migrate check 1-4); `drive seed` creates a demo account (Sign in row in verify.md Drive).

- [ ] T16 Accounts on the server: users, sessions, profiles tables; signup/signin/signout/me with rate limit. Proof: `npm run test:server` (deny proofs seen failing). Access: public (signup, signin), user (me, signout). Migration: yes. Needs: none
- [ ] T17 Progress merge function and progress endpoints. Proof: Jest `src/progress/merge.test.ts`, server tests incl. other-user 404 and signed-out 401. Access: owner of profile. Needs: T16
- [ ] T18 App sign-up/sign-in/sign-out: API client, token storage, `/account` screen, home account state, drive seed demo account. Proof: Jest, e2e `e2e/account.spec.ts`. Access: public. Needs: T16
- [ ] T19 Sync: local-first store pushes and pulls for the signed-in profile, first-sign-in merge, offline notice. Proof: Jest, two-context e2e `e2e/sync.spec.ts`. Needs: T17, T18

## Slice: content-a1 (branch nstack/content-a1)
Learners who finish the Bắt đầu units continue at A1 in every track: everyday u6-u10, work u4-u6, kids u6-u8 (11 units, from the unit list in design.md ## Content). Every A1 unit carries a short Vietnamese usage note (research need 3: grammar explained in Vietnamese: present simple, questions with do/does, a/an/the, prepositions of time and place, can, there is/are). All are Premium under the current split (first 3 units per track free).

Acceptance criteria:
1. The 11 unit files exist and pass the content test (schema, translations, ids, answers among options, word order across units, no template asked to be spoken or typed, at least 6 words and 10 exercises, 2 speak items, note_vi present, sources in SOURCES.md).
2. Each track's batch has a native reader verdict with every problem fixed (log).
3. A1 vocabulary stays within A1 (CEFR-J A1 used as a guide where useful; original writing).

- [x] T26 Everyday A1 u6-u10. Proof: content test, native reader verdict. Content: yes. Needs: none
- [x] T27 Work A1 u4-u6. Proof: content test, native reader verdict. Content: yes. Needs: none
- [x] T28 Kids A1 u6-u8. Proof: content test, native reader verdict. Content: yes. Needs: none

## Slice: content-a2 (branch nstack/content-a2)
Learners continue to A2 in every track: everyday u11-u15 (Ở nhà hàng, Sức khỏe, Thời tiết, Kể chuyện hôm qua with the past simple, Kế hoạch with be going to), work u7-u9 (Họp và nêu ý kiến, Phỏng vấn xin việc, Báo cáo sự cố), kids u9-u10 (Một ngày của em, Cảm xúc). Each with a Vietnamese usage note. This completes the planned zero-to-A2 course (34 units).

Acceptance criteria:
1. The 10 unit files pass the content test (as content-a1, including 2 speak items and note_vi).
2. Each track's batch has a native reader verdict with every problem fixed.
3. A2 grammar is introduced with contrast to Vietnamese (e.g. past time without verb change in Vietnamese vs -ed / irregular forms; "going to" vs "sẽ").

- [ ] T29 Everyday A2 u11-u15. Proof: content test, native reader verdict. Content: yes. Needs: none
- [x] T30 Work A2 u7-u9. Proof: content test, native reader verdict. Content: yes. Needs: none
- [x] T31 Kids A2 u9-u10. Proof: content test, native reader verdict. Content: yes. Needs: none

## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
