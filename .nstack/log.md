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

## 2026-11-27 build T7
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core (from nstack/foundation 93d5aed, rebased onto main after foundation ships)
- [x] 2. Starting state. fast checks pass at 93d5aed
- [x] 3. Dispatch. builder in worktree (parallel with T3, T5)
- [x] 4. Read the reply. done, 00a4d79
- [x] 5. Prove it yourself. merged: typecheck 0, lint 0, jest 32 pass
- [x] 6. Record. this entry, backlog
- [x] Done when: committed on nstack/learn-core, items ticked.
- Decision: learn-core is built on top of the unshipped foundation branch to save time; it is synced with main before its PR.

## 2026-11-27 build T5
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core
- [x] 2. Starting state. fast checks pass after T7 merge
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done, d5a3820; native reader "pass with fixes", 1 fix (e09 accepted "Good-bye") plus 2 suggestions applied
- [x] 5. Prove it yourself. merged: typecheck 0, lint 0, jest 47 pass; broken fixture copied to content/everyday/a0/u2.json -> content test 1 failed, removed
- [x] 6. Record. this entry, plan note on build_sentence alternatives for T8
- [x] Done when: committed on nstack/learn-core, items ticked.

## 2026-11-27 build T9
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core
- [x] 2. Starting state. fast checks pass at 076cadf
- [x] 3. Dispatch. builder in worktree (parallel with T3, T6, T8, T10)
- [x] 4. Read the reply. done, 49c5b5e; native reader "pass with fixes", required fix (five/nine sound cue) and optional Southern variants applied
- [x] 5. Prove it yourself. merged: typecheck 0, lint 0, jest 55 pass (content test covers u2-u5)
- [x] 6. Record. this entry
- [x] Done when: committed on nstack/learn-core, items ticked.

## 2026-11-27 build T10
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core
- [x] 2. Starting state. fast checks pass at 076cadf
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done, 17969db; native reader 2 rounds: round 1 one must-fix, round 2 two must-fix (ambiguous word order, wrong colour picture), all fixed; no third pass on round-2 fixes
- [x] 5. Prove it yourself. merged (index.ts conflict, kept both sides): typecheck 0, lint 0, jest pass (count below)
- [x] 6. Record. this entry, backlog
- [x] Done when: committed on nstack/learn-core, items ticked.
- Decision: kids emoji limited to Unicode 9 for older Android; kids addressed as "con", Northern words with Southern in brackets.

## 2026-11-28 build T6
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core
- [x] 2. Starting state. fast checks pass at 076cadf
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done, bb4fa6a; Jest screen tests seen red against stubs; tracks e2e 18 passed against a served export
- [x] 5. Prove it yourself. merged: typecheck 0, lint 0, jest 78 pass. e2e runs at slice verify after sync with foundation (drive tool)
- [x] 6. Record. this entry, backlog
- [x] Done when: committed on nstack/learn-core, items ticked.

## 2026-11-28 build T8
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core
- [x] 2. Starting state. fast checks pass after T6 merge
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done, c39e1f5; completion-save removal seen failing in Jest and e2e; Maestro syntax checked, not run (no KVM)
- [x] 5. Prove it yourself. merged (conflicts in themed-text.tsx and vi.ts: kept T6's label/meta types and moved T8's small labels to meta with tabular numbers; welcome.* keys dropped): typecheck 0, lint 0, jest 128 pass
- [x] 6. Record. this entry, backlog
- [x] Done when: committed on nstack/learn-core, items ticked.
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

## 2026-11-28 build learn-core design fixes
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core
- [x] 2. Starting state. fast checks pass at 33e1c64
- [x] 3. Dispatch. builder: leave-lesson link (critique: no way out of a lesson on web) and lang="en" on English content (foundation review nit)
- [x] 4. Read the reply. done f82418e; Jest red 2 failed -> green; e2e lang red 1 failed -> green
- [x] 5. Prove it yourself. merged: typecheck 0, lint 0, jest 130 pass
- [x] 6. Record. this entry; backlog: lang on the type_answer input
- [x] Done when: committed, items ticked.

## 2026-11-28 build learn-core content fixes
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/learn-core
- [x] 2. Starting state. fast checks pass
- [x] 3. Dispatch. builder with the native reader recheck findings (2 must-fix ambiguous build_sentence, 5 wording)
- [x] 4. Read the reply. done 61bbabb; fresh reader passed every changed item
- [x] 5. Prove it yourself. merged: jest 128 pass (content test)
- [x] 6. Record. this entry; minors in backlog
- [x] Done when: committed, items ticked.
## 2026-11-28 review foundation
- Read: review/SKILL.md c151f88
- [x] 1. Dispatch. reviewer at 4a5f679: fix-needed, 1 important (UI-string checker misses template literals, +, options titles), 2 nits (lang="en" on web, drive pid check on macOS)
- [x] 2. Second reviewer. n/a: no auth, payments, migrations of data, concurrency or public API (health only)
- [x] 3. Act on every finding. important + pid nit: fresh builder, merged (red 5 failed -> green 14; drive pid test red -> green); lang nit: moved to learn-core where the English content screens are (builder dispatched)
- [x] 4. Review the fixes. Round 2 (44c4291): 1 important (screenOptions, options functions, quoted keys, tabBarLabel still missed). Shared premise of both fixes (we can list where text appears) attacked: builder inverted the rule to report every lettered string in JSX outside an allowlist (cdd1a94, red 9 failed -> green 27). Round 3 (4bdbefe): 1 important (allowlisted prop names also exempted object keys, e.g. t("x", { name: "Bạn" })) + 1 nit (strings outside JSX, backlog). Fixed by the controller in 15ad710 (10+/3- lines, one finding): new test red without the fix (1 failed), green with it; small-fix exception used, no round 4.
- [x] Done when: latest round's important finding fixed under the small-fix exception, verify re-run at 15ad710 (below), nits fixed or in backlog.md.

## 2026-11-28 verify foundation (after review fixes)
- Read: verify/SKILL.md adc6a8a
- [x] 1. Clean tree. 15ad710
- [x] 2. Project checks. typecheck 0, lint 0, jest 30 pass, test:server 21 pass, test:drive 6 pass, drive check passed, e2e 3 passed
- [x] 3. Every acceptance criterion in scope has a passing check. as before; check-features exit 0
- [x] 4. Every new check bites. checker tests red before each fix (5, 9, 1 failed), drive pid test red
- [x] 5. The real thing runs. drive check
- [x] 6. Every changed screen looks right. no screen changed since the first verify
- [x] 7. Nothing got weaker. no tests removed or loosened
- [x] 8. No new warnings or errors. lint 0 warnings
- [x] 9. Access is enforced. check-security exit 0 at c24cb0d; no route changed since
- [x] Done when: all ticked. Not verified: iOS (CI job on the PR), Android flows (no KVM, parked).

## 2026-11-28 ship foundation
- Read: ship/SKILL.md b51cd2a
- [x] 1. Commit. slice commits on nstack/foundation
- [x] 2. Sync. origin/main is the initial commit (65220f0), already in the branch
- [x] 3. Push. nstack/foundation
- [x] 4. Open the PR. #1 with verification table, merge danger, decisions
- [x] 5. Wait for CI. run 46088263694 at d4a607a: ubuntu checks pass, iOS simulator build pass (18m35s)
- [ ] 6. Merge
- [ ] 7. Confirm and clean up.
- [ ] Done when: the PR is merged, CI is green on the default branch, and the fast checks pass there, or the PR is parked with a reason.

## 2026-11-28 verify learn-core
- Read: verify/SKILL.md adc6a8a
- [x] 1. Clean tree. code at f61e4f4 (later commits: sync with main touching only .nstack and removing the re-added welcome tests); head 97eedbc
- [x] 2. Project checks. typecheck 0, lint 0, jest 147 pass, test:server 21, test:drive 6, drive check passed (24 screenshots), e2e 18 passed
- [x] 3. Every acceptance criterion in scope has a passing check. 1 content test (+broken fixture red); 2 content files + reader verdicts (T5, T9, T10, recheck); 3 tracks.spec + lesson.spec reload; 4 word-card Jest (speech on/off); 5 answers Jest + lesson Jest per exercise; 6 progress-store Jest, Maestro written (not run: no KVM, parked); 7 critique below + a11y.spec axe on 6 screens light/dark. check-features exit 0
- [x] 4. Every new check bites. content test (broken fixture), progress-store (builder mutations), lesson completion save removed -> Jest and e2e red, tracks screen focus refresh removed -> red, lang test red, leave link red
- [x] 5. The real thing runs. drive check + e2e against the drive server
- [x] 6. Every changed screen looks right. /tmp/shots-lc/{home,track,track-kids,track-not-found,lesson,lesson-not-found}-{390,1280}-{light,dark}.png and /tmp/shots-lc/step-*.png: 1 primary action obvious (track rows; "Bắt đầu học"; "Tiếp tục") pass; 2 spacing on scale pass; 3 readable, Vietnamese diacritics clear pass; 4 no overflow pass; 5 not-found states have a way back, wrong-answer feedback intended pass; 6 paper/purple ink/ô-ly grid, no shadows pass; 7 keyboard focus e2e (tracks) pass; 8 copy names actions pass; 9 hierarchy pass. Removed: none needed after adding the leave link (critique fail fixed)
- [x] 7. Nothing got weaker. welcome.spec removed because the welcome screen became the track picker (spec change, logged in sync commit); axe loop moved into a11y.spec for all screens
- [x] 8. No new warnings or errors. lint 0 warnings
- [x] 9. Access is enforced. n/a: no routes, tables or auth touched (app-only, public)
- [x] Done when: all ticked. Not verified: Android Maestro lesson flow (no KVM, parked).
- [x] 6. Merge (ship foundation, continued). gh pr merge 1 --squash -> MERGED 37f40e0
- [x] 7. Confirm and clean up. main pulled; typecheck 0, lint 0, jest 30, test:server 21, test:drive 6; CI on 37f40e0: ubuntu success, iOS success; nstack/foundation deleted locally and on origin (tree identical to main)
- [x] Done when: PR #1 merged, CI green on main, fast checks pass there.

## 2026-11-28 review learn-core
- Read: review/SKILL.md c151f88
- [x] 1. Dispatch. reviewer at 1a403d7: fix-needed. Important: web shows a silent "Nghe" with no voices and hides listen text (AC4); options never shuffled (answer at index 0 in 60/114). Nit: answers keyed by exercise id vs review-speak plan premise.
- [x] 2. Second reviewer. n/a: no auth, payments, migrations, concurrency or public API in learn-core
- [ ] 3. Act on every finding. Both important: fix builder dispatched. Nit: already handled by T11 on review-speak (the schedule reads review answers recorded under word ids, and ignores lesson answers keyed by exercise id; src/review/schedule.test.ts passes), so no change here.
- [ ] 4. Review the fixes
- [ ] Done when: the latest round has no important findings, verify passed after the last fix, and nits are fixed or in backlog.md.
