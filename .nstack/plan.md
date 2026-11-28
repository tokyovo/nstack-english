# Plan

Later slices (in order, planned in full when reached): family (parent account, child profiles, parent gate, per-child progress), plans (free/premium entitlements, server-served premium lessons, payments parked), content-a1, content-a2.

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

## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
- review-speak: T11-T15, PR #3
