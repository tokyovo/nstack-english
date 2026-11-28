# Plan

Later slices (in order, planned in full when reached): family (parent account, child profiles, parent gate, per-child progress), plans (free/premium entitlements, server-served premium lessons, payments parked), content-a1, content-a2.

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
- accounts-sync: T16-T19b, PR #5
