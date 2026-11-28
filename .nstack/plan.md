# Plan

Later slices (in order, planned in full when reached): plans (free/premium entitlements, server-served premium lessons, payments parked), content-a1, content-a2.

## Slice: accounts-sync (branch nstack/accounts-sync)
A learner can create an account with email and password, sign in on another phone or the web, and find the same progress there. Learning without an account keeps working; the first sign-in on a device adds that device's progress to the account (nothing is lost, research need 2). Progress saves locally first and syncs when online; the app says when it is offline.

Design: the server keeps one progress document per profile and merges what a client sends with what it has, using one pure merge function shared by app and server (`src/progress/merge.ts`, no React Native imports; the server imports it by path). The merge is a union: lessons per unit keep the earliest first completion, latest last completion and best score; answers per item are a set of (time, correct) pairs. Union is idempotent and order-independent, so retries and two devices syncing in any order converge (principle 8); no conflict UI is needed. Considered: per-answer rows with a sync cursor (more tables and code, needed only at much larger data sizes). Auth: email + password hashed with scrypt (node:crypto), opaque random session tokens stored hashed, sent as `Authorization: Bearer` from all three apps (no cookies, so no CSRF); tokens kept in expo-secure-store on native and localStorage on web. Each user gets one `owner` profile at sign-up (child profiles come in the family slice).

Acceptance criteria:
1. `POST /api/auth/signup`, `/signin`, `/signout`, `GET /api/me`: server tests for success, duplicate email (409), wrong password (401, same message as unknown email), weak password (400, min 8 chars), signed-out `/api/me` (401), and sign-in rate limiting (429 after 10 failures per email per 15 min).
2. `GET` and `PUT /api/profiles/:id/progress`: PUT merges and returns the merged document; another user's profile answers 404; signed-out answers 401 (deny proofs). Merge unit tests: idempotent, commutative, keeps the best of each lesson, unions answers.
3. `/account` screen: sign up, sign in, sign out, Vietnamese errors next to the field that caused them, typed input kept after an error. Home shows the account state.
4. Sync: on sign-in the device's local progress is merged into the account; lesson and review answers push after saving; the app pulls on start and on focus; offline shows "Đang ngoại tuyến, tiến độ sẽ được đồng bộ sau". e2e with two browser contexts: A signs up and completes everyday A0 u1; B signs in and sees it completed.
5. Migrations are repeatable (migrate check 1-4); `drive seed` creates a demo account (Sign in row in verify.md Drive).

- [x] T16 Accounts on the server: users, sessions, profiles tables; signup/signin/signout/me with rate limit. Proof: `npm run test:server` (deny proofs seen failing). Access: public (signup, signin), user (me, signout). Migration: yes. Needs: none
- [x] T17 Progress merge function and progress endpoints. Proof: Jest `src/progress/merge.test.ts`, server tests incl. other-user 404 and signed-out 401. Access: owner of profile. Needs: T16
- [x] T18 App sign-up/sign-in/sign-out: API client, token storage, `/account` screen, home account state, drive seed demo account. Proof: Jest, e2e `e2e/account.spec.ts`. Access: public. Needs: T16
- [x] T19 Sync: local-first store pushes and pulls for the signed-in profile, first-sign-in merge, offline notice. Proof: Jest, two-context e2e `e2e/sync.spec.ts`. Needs: T17, T18
- [x] T19b Signing out leaves no progress on the device for the next person: on sign-out the app syncs, then clears the device copy; if the sync fails (offline) it says so and asks before signing out and discarding unsynced answers. A new sign-in on that device starts from the account only. Proof: Jest, e2e (A signs out, B signs in, B has none of A's lessons). Needs: T19

## Slice: family (branch nstack/family)
A parent with an account adds child profiles (a nickname and a picture, nothing else), renames or deletes them, and hands the phone to a child: the app then shows only that child's learning, with its own progress, starting on the kids track. Leaving the child's profile, or reaching the account, profiles or (later) plan screens, needs the parent gate. The parent sees each child's progress on the profiles screen (research need 9).

Design: profiles already exist on the server (`kind` owner/child, `name`). Children are added under the owner's account (at most 4). A child profile gets its own session token, scoped to that profile (`sessions.profile_id`): with it the app can only read and sync that child's progress; every account and profile-management endpoint answers 403. So "a child cannot reach account or purchase settings" holds on the server, not only in the UI. The app keeps the parent token in secure storage while a child is active and switches tokens through the parent gate. Parent gate: a multiplication of two numbers from 6 to 9 written in Vietnamese words, answered with digits (a common pattern for kids apps; keeps young children out, never meant as security). Pictures are a fixed set of 8 animal emoji (no uploads, no real photos). Considered: PIN set by the parent (more screens and a reset path for a forgotten PIN); the gate is simpler and can be swapped later.

Acceptance criteria:
1. `POST /api/profiles` (owner session) creates a child `{name, picture}` (name 1-20 chars, picture from the fixed set; 5th child answers 409); `PATCH /api/profiles/:id` renames or changes the picture; `DELETE /api/profiles/:id` deletes a child and its progress (owner profile cannot be deleted: 400). Another user's child answers 404; signed out 401 (deny proofs).
2. `POST /api/profiles/:id/session` (owner session) returns a child-scoped token. With it: `GET/PUT /api/profiles/<that child>/progress` work; the owner's or a sibling's progress answers 404; `GET /api/me`, `POST /api/profiles`, `PATCH`/`DELETE /api/profiles/:id`, `POST /api/profiles/:id/session` answer 403 (deny proofs seen failing).
3. `/profiles` screen (signed-in parent): lists the owner and each child with lessons completed and words due; add (nickname, picture picker), rename, delete with a confirmation that names the child and says the progress is deleted. Vietnamese errors next to the field.
4. Switching to a child shows the child's name on home, uses the child's progress (separate from the parent's: Jest and e2e), defaults the track list to Trẻ em first; `/account` and `/profiles` show the parent gate while a child is active; a wrong answer keeps the child where they are; a right answer returns to the parent. e2e covers add child, switch, learn as the child, gate, back to parent, both progress sets distinct.
5. No child email, real name field, birthday or location anywhere (the child form has only nickname and picture); no third-party trackers (dependency list unchanged apart from first-party Expo modules).

- [ ] T20 Server: child profile create/rename/delete with limits; child-scoped sessions; 403 for child tokens on account and profile endpoints. Proof: `npm run test:server` (deny proofs seen failing). Access: owner (manage), child (own progress). Migration: yes. Needs: accounts-sync
- [ ] T21 App profiles screen: list with per-profile progress summary, add/rename/delete with confirmation. Proof: Jest, e2e `e2e/profiles.spec.ts`, axe. Access: parent. Needs: T20
- [ ] T22 Active profile and child mode: token switching, parent gate on /account and /profiles, kids track first, separate progress and sync. Proof: Jest, e2e `e2e/child-mode.spec.ts`. Access: parent / child. Needs: T20, T21

## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
- review-speak: T11-T15, PR #3
