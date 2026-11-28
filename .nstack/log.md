# Log

## 2026-11-27 research english app for vietnamese
- Read: research/SKILL.md 624728a
- [x] 1. Frame the search. Generic category: English-learning app for Vietnamese beginners; no features yet.
- [x] 2. Gather. 33 sources (subagent).
  - [x] 2.1. Communities. Reddit blocked, voz/tinhte 403, webtretho no results; worked from search snippets.
  - [x] 2.2. Hacker News. Algolia API searched.
  - [x] 2.3. Similar products. Feature and pricing pages of the leading apps.
  - [x] 2.4. Open-source alternatives. gh search repos and top issues.
  - [x] 2.5. Reviews. App Store reviews; Google Play not reached.
  - [x] 2.6. This project's own feedback. n/a: new project, no issues.
- [x] 3. Synthesize. 9 needs kept.
  - [x] 3.1. Group findings into needs. research.md ## Needs
  - [x] 3.2. Count independent sources. counts in research.md
  - [x] 3.3. Mark each need. all missing (new app)
  - [x] 3.4. Keep a need with 3+ sources or one severe. 9 kept, data-loss one severe
- [x] 4. Record. research.md, backlog.md (unscored)
- [x] Done when: research.md lists needs with sources, 5 source kinds tried, each kept need in backlog.md.
- Decision: content sources: original writing first; Tatoeba (CC BY 2.0 FR) and CEFR-J (free commercial with citation) allowed via a pinned script; Wiktionary/wordfreq (CC BY-SA) only if share-alike is acceptable for the data file; Oxford 3000/EVP not used.

## 2026-11-27 mobile setup
- Read: mobile/SKILL.md 227ddf2
- [ ] 1. Setup
  - [x] 1.1. Project. create-expo-app default template (SDK 58, Expo Router, TS), commit a846827.
  - [~] 1.2. Android emulator. AVD nstack35 exists, /dev/kvm is root:kvm 0660 and this user is not in kvm; granting access via sudo was refused. Parked in needs-human.md.
  - [ ] 1.3. Drive tool. foundation T3
  - [ ] 1.4. iOS. foundation T4 (macOS CI job)
- [ ] 2. Tests. foundation T1 (Jest), T3 (Playwright, Maestro)
- [x] 3. Platform rules. Recorded for builders through the brief pointer to mobile/SKILL.md.
- [ ] 4. Stores and money. Entitlement slice later; payments parked.
- [ ] Done when: each changed native flow passes on the Android emulator from a release build and was seen to fail, the iOS CI job passed or is parked, and the web tests pass.
- Decision: API server is a separate Node 24 TypeScript app in server/ (Hono + node:sqlite, node --test) instead of Expo API routes, because it tests without Metro and needs no extra database; web export is static and served by the same server.

## 2026-11-27 content plan
- Read: content/SKILL.md 7aa1bb5
- [x] 1. Plan the content. design.md ## Content
  - [x] 1.1. Learners and levels. A0/A1/A2, three tracks
  - [x] 1.2. Units. 15 everyday, 9 work, 10 kids
  - [x] 1.3. Item types. 7 types with fields
  - [x] 1.4. Sources. original first, open data via pinned script + SOURCES.md
- [x] 2. Sources. research.md "Content sources"
- [ ] 3. Rules
  - [ ] 3.1. Content is data. learn-core slice
  - [ ] 3.2. A content test. learn-core slice
  - [ ] 3.3. The interface in the users' language. foundation T1
  - [ ] 3.4. A native reader. per content ticket
  - [x] 3.5. Children. Decision in design.md: ages 4-10, parent-owned profiles with nickname + picture only, no ads/trackers/chat.
- [ ] Done when: the content test passes, SOURCES.md lists every outside source with a commercial-use license, every UI string comes from the messages files, and the native reader's problems are fixed.
- Decision: free plan = units 1-3 of every track; the rest premium (easy to change in one config). Price and the split are business choices: parked as a non-blocking item.

## 2026-11-27 plan foundation
- Read: plan/SKILL.md e056824
- [x] 1. Learn the ground truth. Fresh Expo template; tsc fails on template example files (removed in T1).
- [x] 2. Interrogate the goal yourself
  - [x] 2.1. Open questions listed (backend, web output, names, sync model).
  - [x] 2.2. Answered from Expo docs/conventions.
  - [x] 2.3. Decisions logged (server architecture, names in plan).
- [x] 3. Write the spec. plan.md slice foundation, 7 criteria
- [x] 4. Cut tickets. T1-T4; T1 and T2 parallel
- [x] 5. Check the plan
  - [x] 5.1. Each criterion maps: 1-3 T1, 4 T2, 5-6 T3, 7 T4.
  - [x] 5.2. Fresh reader asked 15 questions; all answered in plan.md "Answers for builders".
  - [x] 5.3. Slice in plan.md with branch nstack/foundation.
- [x] Done when: every criterion has a proof, the fresh reader's questions are answered in the plan, and the slice is in plan.md.
- Decision: app name "Học Tiếng Anh", package app.hocenglish.

## 2026-11-27 build T2
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/foundation
- [x] 2. Starting state. n/a: no fast checks existed yet (template tsc errors are T1's)
- [x] 3. Dispatch. builder in worktree, parallel with T1
- [x] 4. Read the reply. done, commit 0a190d8
- [x] 5. Prove it yourself. After merge: test:server 13 pass 0 fail; typecheck:server exit 0; eslint server exit 0
- [x] 6. Record. this entry; backlog lines added
- [x] Done when: committed on nstack/foundation (merge), items ticked.
- Decision: server binds 127.0.0.1; T3 tightens CSP when serving dist/.

## 2026-11-27 build T1
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/foundation
- [x] 2. Starting state. n/a: template tsc failed; T1 is the ticket that creates the checks
- [x] 3. Dispatch. builder in worktree, parallel with T2
- [x] 4. Read the reply. done, commit 4e1426f
- [x] 5. Prove it yourself. Merged with T2 (conflicts in package.json/tsconfig resolved keeping both; typecheck now chains tsc -p server). typecheck 0, lint 0, jest 15 pass, test:server 13 pass. Planted "Planted text" in src/app/index.tsx: string test 1 failed; reverted.
- [x] 6. Record. this entry; backlog lines added
- [x] Done when: committed on nstack/foundation, items ticked.

## 2026-11-27 build T3
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/foundation
- [x] 2. Starting state. fast checks pass at 93d5aed
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done, 2868f89; axe seen failing on planted low contrast, drive screens seen failing on planted 404
- [x] 5. Prove it yourself. merged: typecheck 0, lint 0, jest 15, test:server 21, test:drive 5, drive check exit 0 (4 screenshots, db deleted), e2e 3 passed; check-features exit 0
- [x] 6. Record. verify.md Drive and Features sections, backlog
- [x] Done when: committed on nstack/foundation, items ticked.
- Decision: @playwright/test pinned to 1.65.0 to match the cached browser; CI installs chromium.

## 2026-11-28 verify foundation
- Read: verify/SKILL.md adc6a8a
- [x] 1. Clean tree. c24cb0d, git status clean
- [x] 2. Project checks. typecheck 0, lint 0 warnings, jest 15 pass, test:server 21 pass 0 skipped, test:drive 5 pass, drive check passed, e2e 3 passed
- [x] 3. Every acceptance criterion in scope has a passing check. 1-2 typecheck/lint/jest (ui-strings test); 3 e2e welcome.spec + screenshots; 4 test:server; 5 drive --help + drive check; 6 e2e a11y.spec (axe); 7 actionlint exit 0 (builder) and the PR's CI run (ship). check-features exit 0
- [x] 4. Every new check bites. UI-string test: planted literal -> 1 failed. Server: health ok:false -> 1 failed, restored. Axe (planted low contrast) and drive screens (planted 404) seen failing by T3 builder; migrator mutations by T2 builder.
- [x] 5. The real thing runs. drive check started the server with dist/, loaded /, screenshots, no console errors
- [x] 6. Every changed screen looks right. /tmp/shots-f/welcome-{390,1280}-{light,dark}.png: 1 n/a no action yet (placeholder screen replaced in learn-core); 2 spacing on 4px scale pass; 3 contrast/size pass; 4 no overflow pass; 5 n/a no states; 6 matches design.md (paper, purple ink, ô-ly grid) pass; 7 n/a no controls; 8 copy pass; 9 title stands out pass
- [x] 7. Nothing got weaker. no eslint-disable, ts-ignore, any or skip in src/server/scripts/e2e
- [x] 8. No new warnings or errors. first recorded counts
- [x] 9. Access is enforced. check-security exit 0 (no non-public features yet; headers ok, no secrets in bundle, 0 high/critical advisories)
- [x] Done when: all ticked. Not verified: iOS build (CI macOS job, runs on the PR); Android flows (no KVM, parked).

## 2026-11-28 review foundation
- Read: review/SKILL.md c151f88
- [x] 1. Dispatch. reviewer at 4a5f679: fix-needed, 1 important (UI-string checker misses template literals, +, options titles), 2 nits (lang="en" on web, drive pid check on macOS)
- [x] 2. Second reviewer. n/a: no auth, payments, migrations of data, concurrency or public API (health only)
- [x] 3. Act on every finding. important + pid nit: fresh builder, merged (red 5 failed -> green 14; drive pid test red -> green); lang nit: moved to learn-core where the English content screens are (builder dispatched)
- [ ] 4. Review the fixes. fix is 101+/19- lines: new reviewer round dispatched
- [ ] Done when: the latest round has no important findings, verify passed after the last fix, and nits are fixed or in backlog.md.
