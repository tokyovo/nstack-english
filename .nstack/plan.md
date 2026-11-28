# Plan


## Slice: plans (branch nstack/plans)
Learners see which lessons are free and which need Premium. Free covers the first 3 units of every track (research need 4: a free plan you can really learn on, no ads, no energy limits); review, speaking and sync stay free. Premium unlocks every unit. A Premium learner's children get Premium too. Premium is granted by a server-side record; store (App Store, Google Play) and card payments are not connected: the Premium screen says payment is coming, and connecting them is parked for a person with exact steps.

Design: one entitlement model on the server: `entitlements(user_id, source, starts_at, expires_at, external_ref)` where source is `manual | app_store | google_play | card`; a user is Premium while any row is current. All three apps read it from `GET /api/me` (`plan: {kind: 'free' | 'premium', until}`), so later store and card integrations only insert rows (mobile skill, section 4). A grant is made with a server CLI (`npm run grant -- <email> <days> [--source manual]`), not an HTTP endpoint, so there is nothing to attack. Free units stay bundled in the app (offline); premium units are not in the app bundle: the app ships only their titles (a manifest generated from content/ by `npm run content:manifest`, kept in sync by a test), and fetches a premium unit's body from `GET /api/units/:id`, which answers 401 signed out and 403 without Premium, then caches it on the device for offline use. Free/premium split in one constant `FREE_UNITS_PER_TRACK = 3` (needs-human item for the business decision).

Acceptance criteria:
1. Server tests: `GET /api/me` reports free, then premium after `npm run grant`, then free after expiry (injected clock); a child token's plan follows its parent; the grant CLI is idempotent for the same reference.
2. `GET /api/units/<premium id>`: 401 signed out, 403 free user, 403 a free user's child, 200 Premium user and their child (deny proofs seen failing); free units also answer 200 to anyone.
3. The web bundle contains no premium unit's exercises (a test greps the exported `dist/` for a premium exercise id and fails if present); the manifest test fails when content/ and the manifest disagree.
4. Track screens mark premium units with "Premium" and a lock for free users; opening one shows `/premium` (what Premium includes, price "sẽ công bố", payment not available yet, how to get it); signed-in Premium users open and finish premium lessons, also offline after the first open (Jest, e2e with the demo account granted by `drive seed`).
5. In child mode `/premium` is behind the parent gate. needs-human.md lists the store and card steps (App Store Connect subscription product, Play Console product, a card processor account, webhooks that insert entitlement rows).

- [ ] T23 Entitlements table, plan in /api/me (child follows parent), grant CLI. Proof: `npm run test:server`. Access: owner, child (read plan). Migration: yes. Needs: family
- [ ] T24 Premium unit bodies served by the server only: manifest generator and test, `GET /api/units/:id` with deny proofs, bundle test. Proof: server tests, Jest manifest test, dist grep test. Access: premium. Needs: T23
- [ ] T25 App: locks on track screens, `/premium` screen, fetch and cache premium units, parent gate in child mode, drive seed grants the demo account. Proof: Jest, e2e `e2e/premium.spec.ts`, axe. Needs: T23, T24

## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
- review-speak: T11-T15, PR #3
- content-a1 + content-a2: T26-T32, PR #4
- accounts-sync: T16-T19b, PR #5
- family: T20-T22b, PR #6
