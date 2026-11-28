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

## 2026-11-28 build T11
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/review-speak (from nstack/learn-core, synced to main once foundation and learn-core ship)
- [x] 2. Starting state. fast checks pass on learn-core (jest 130)
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done, e7489a5; stub red 9/11, mutation (early answers) red
- [x] 5. Prove it yourself. merged: jest src/review 11 pass
- [x] 6. Record. this entry
- [x] Done when: committed on nstack/review-speak, items ticked.
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
- [ ] 4. Review the fixes. fix is 101+/19- lines: new reviewer round dispatched
- [ ] Done when: the latest round has no important findings, verify passed after the last fix, and nits are fixed or in backlog.md.

## 2026-11-28 build T12
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/review-speak
- [x] 2. Starting state. fast checks pass at 7e4dd49
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done 825a0a0; mutations red (distractors from all tracks, home counting learned words, answers not recorded); Maestro syntax only (no KVM)
- [x] 5. Prove it yourself. merged; UI-string test flagged t(cond ? 'a' : 'b') keys: checker taught that conditional branches of a t() key are keys (test red 2 failed -> green). jest 172 pass, drive check passed, e2e 21 passed
- [x] 6. Record. this entry, backlog
- [x] Done when: committed on nstack/review-speak, items ticked.
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

## 2026-11-28 build T13
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/review-speak
- [x] 2. Starting state. fast checks pass at 7e4dd49
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done c84da3a; expo-speech-recognition ~58.0.1 (MIT, SDK 58 line); red first for schema, scorer, recognition, speak component; Vietnamese usage strings in app config
- [x] 5. Prove it yourself. merged; UI-string test flagged reason: "declined" (state discriminant) and review e2e lacked a speak step: fixed (994a52e; checker test red 2 failed -> green). jest 224 pass, e2e 23 passed, drive check passed
- [x] 6. Record. this entry, backlog
- [x] Done when: committed on nstack/review-speak, items ticked. Native recognition not run (no KVM; iOS builds in CI).
- Decision: listening gives up after 15 s (headless browsers listen forever) and offers self-check; "nothing heard" can switch to self-check.

## 2026-11-28 build T14
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/review-speak
- [x] 2. Starting state. fast checks pass at 5f55b46
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done d6c664c; native reader "pass with fixes", 4 fixes applied (son/sun and mouth/mouse misrecognition risks, polite form, speaker voice)
- [x] 5. Prove it yourself. merged: jest pass (count below), content test covers speak items
- [x] 6. Record. this entry, backlog
- [x] Done when: committed, items ticked.

## 2026-11-28 build T15
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/review-speak
- [x] 2. Starting state. fast checks pass at 5f55b46
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done 68d5a3a; session and review tests red first; shared useAnswerSaver, StepBar, e2e/learner.ts
- [x] 5. Prove it yourself. merged: typecheck 0, lint 0, jest 228, drive check passed, e2e 23 passed
- [x] 6. Record. this entry, backlog
- [x] Done when: committed, items ticked.
- Decision: no speak step in reviews without recognition (a self-mark would advance the schedule without proof).
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

## 2026-11-28 verify review-speak
- Read: verify/SKILL.md adc6a8a
- [x] 1. Clean tree. 255d7a3
- [x] 2. Project checks. typecheck 0, lint 0, jest 228, test:server 21, test:drive 6, e2e 23 passed, drive screens 28 shots exit 0
- [x] 3. Every acceptance criterion in scope has a passing check. 1 schedule.test (wrong before right); 2 review.spec (page.clock, count drops) + review Jest; 3 content test + reader verdicts (T14); 4 score.test near misses, speak-answer Jest both paths, lesson e2e fallback and real-API explain-then-fallback; 5 .maestro/review.yaml written, not run (no KVM, parked). check-features exit 0
- [x] 4. Every new check bites. schedule stub red 9/11; review mutations red (distractors, due count, answers not recorded); speak component and scorer red first; checker test red for kind/reason
- [x] 5. The real thing runs. e2e against the drive server (review after a simulated day; speak fallback)
- [x] 6. Every changed screen looks right. /tmp/shots-rs/review-*.png (empty), /tmp/t12-shots/home-{due,notdue,empty}-*, review-step{1,2,3}-*, review-feedback-*, review-result-* at 390/1280 light/dark: 1 primary action (Ôn tập ngay, Kiểm tra) pass; 2 spacing pass; 3 readable pass; 4 no overflow pass; 5 empty states with hints, disabled Kiểm tra looks intended pass; 6 matches design.md pass; 7 focus (axe + keyboard in e2e) pass; 8 copy names actions pass; 9 hierarchy pass. Speak states critiqued by T13 builder (ready, explain, listening, nothing heard, self-check, wrong)
- [x] 7. Nothing got weaker. one eslint-disable-next-line no-require-imports in src/speech/recognition.ts: lazy require of the optional native module so a missing module means no recognition instead of a crash (logged, justified)
- [x] 8. No new warnings or errors. lint 0 warnings
- [x] 9. Access is enforced. n/a: no routes, tables or auth
- [x] Done when: all ticked. Not verified: native recognition on Android/iOS devices (no KVM; iOS build only), Maestro review flow (parked).

## 2026-11-28 review review-speak
- Read: review/SKILL.md c151f88
- [x] 1. Dispatch. reviewer at 49fd51e: fix-needed. Important: review uses template words ("My name is ...") for speak and type_answer, marking correct sentences wrong. Nit: joined digits ("123") fail counting speak items.
- [x] 2. Second reviewer. n/a: no auth, payments, migrations, concurrency or public API
- [x] 3. Act on every finding. builder fixed both (89fea76): session red 9 failed, check red 1, score red 3 -> green; after merge jest 248, e2e 23 passed
- [ ] 4. Review the fixes. Round 2 at ee4792f: 1 important (Maestro flows hardcode exercise counts and positions, broken by the new speak items; review flow cannot answer a speak step), 1 nit ("reviewed all" message before any review). Fixed in b7e27a2 (with learn-core synced in): flows loop over one shared answer-step subflow until the result; new Jest guard src/__tests__/maestro-flows.test.ts red 7 against old flows; home message rule whyNothingDue red 2 -> green. jest 270, e2e 24, drive check passed, check-features 0. Round 3 dispatched.
- [ ] Done when: the latest round has no important findings, verify passed after the last fix, and nits are fixed or in backlog.md.
- [x] 4. Review the fixes. Round 2 at ee4792f: 1 important (Maestro flows hardcode exercise counts and positions, broken by the new speak items; review flow cannot answer a speak step), 1 nit ("reviewed all" message before any review). Fixed in b7e27a2 (with learn-core synced in): flows loop over one shared answer-step subflow until the result; new Jest guard src/__tests__/maestro-flows.test.ts red 7 against old flows; home message rule whyNothingDue red 2 -> green. jest 270, e2e 24, drive check passed, check-features 0. Round 3 at 90b69ea: 1 important (double tap on Nói starts two recognisers and records the answer twice). Fixed by the controller in cd96d79 (speak-answer.tsx +19/-4, one finding): new test red (start called 2, onAnswer 2) -> green; small-fix exception used.
- [x] Done when: last important finding fixed under the small-fix exception; verify after sync with main at 3a4789a: typecheck 0, lint 0, jest 271, test:server 21, test:drive 6, drive check passed, e2e 24 passed, check-features 0, check-security 0 (after giving the content row an access level); nits in backlog.
- Lesson: Maestro flows that never run went stale twice (option positions after shuffle, exercise counts after new content). Check added: src/__tests__/maestro-flows.test.ts rejects fixed counts, fixed-length repeats and answer taps outside the shared subflow.
- [x] 6. Merge (ship foundation, continued). gh pr merge 1 --squash -> MERGED 37f40e0
- [x] 7. Confirm and clean up. main pulled; typecheck 0, lint 0, jest 30, test:server 21, test:drive 6; CI on 37f40e0: ubuntu success, iOS success; nstack/foundation deleted locally and on origin (tree identical to main)
- [x] Done when: PR #1 merged, CI green on main, fast checks pass there.

## 2026-11-28 review learn-core
- Read: review/SKILL.md c151f88
- [x] 1. Dispatch. reviewer at 1a403d7: fix-needed. Important: web shows a silent "Nghe" with no voices and hides listen text (AC4); options never shuffled (answer at index 0 in 60/114). Nit: answers keyed by exercise id vs review-speak plan premise.
- [x] 2. Second reviewer. n/a: no auth, payments, migrations, concurrency or public API in learn-core
- [x] 3. Act on every finding. Both important fixed by a builder (855bb91): speech red 4/6 -> green, e2e no-voice walkthrough red -> green, shuffle red -> green. After merge: typecheck 0, lint 0, jest 158, test:server 21, test:drive 6, drive check passed, e2e 19 passed. Nit: already handled by T11 on review-speak (the schedule reads review answers recorded under word ids, and ignores lesson answers keyed by exercise id; src/review/schedule.test.ts passes), so no change here.
- [x] 4. Review the fixes. Round 2 at a99f702: pass, no findings (mutations on shuffle and voice detection red; e2e 19 passed)
- [x] Done when: latest round has no important findings; verify passed after the fix (jest 158, e2e 19, drive check passed); nits handled.

## 2026-11-28 ship learn-core
- Read: ship/SKILL.md b51cd2a
- [x] 1. Commit. slice commits on nstack/learn-core
- [x] 2. Sync. merged origin/main (foundation squash) with -X ours, removed the welcome tests main re-added; verify re-run (jest 158, e2e 19, drive check)
- [x] 3. Push. nstack/learn-core
- [x] 4. Open the PR. #2 with verification table, merge danger, decisions
- [x] 5. Wait for CI. run 46092263310 at 261d6dd: ubuntu pass, iOS pass
- [x] 6. Merge. squash, 67caa0f
- [x] 7. Confirm and clean up. main pulled: typecheck 0, lint 0, jest 158, test:server 21; branch and worktree deleted local and remote (tree identical). CI on main: see next entry
- [x] Done when: PR #2 merged, fast checks pass on main.

## 2026-11-28 build T27
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/content-a1
- [x] 2. Starting state. fast checks pass at cf389ee
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done ee04ce5; native reader "pass with fixes": 1 must-fix (missed valid word order) + 10 optional, all fixed
- [x] 5. Prove it yourself. merged: jest and typecheck below
- [x] 6. Record. this entry, backlog
- [x] Done when: committed, items ticked.

## 2026-11-28 build T28
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/content-a1
- [x] 2. Starting state. fast checks pass at cf389ee
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done 19836a8; native reader "pass after fixes": 16 points, 14 fixed, 2 kept as the reader allowed (wording, friend emoji)
- [x] 5. Prove it yourself. merged: jest and typecheck below
- [x] 6. Record. this entry
- [x] Done when: committed, items ticked.

## 2026-11-28 build T26
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/content-a1
- [x] 2. Starting state. fast checks pass at cf389ee
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done 50fa35b; native reader: 1 fix (missed word order), 1 nit, 2 optional, all applied
- [x] 5. Prove it yourself. merged: jest, typecheck, lint, e2e below
- [x] 6. Record. this entry
- [x] Done when: committed, items ticked.

## 2026-11-28 build T31
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/content-a2
- [x] 2. Starting state. fast checks pass at 848f1f3
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done eecc2b9; native reader "pass with fixes", 7 problems fixed
- [x] 5. Prove it yourself. merged: content tests below
- [x] 6. Record. this entry
- [x] Done when: committed, items ticked.
- Lesson: Jest component tests timed out under parallel-builder load twice (T3, T31 builders). Check: raise the Jest testTimeout for component suites (ticket below), so load does not fail a correct test.

## 2026-11-28 build T30
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/content-a2
- [x] 2. Starting state. fast checks pass at 848f1f3
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done eb04892; native reader "correct and ready", all raised items fixed (extra valid orders, accepted answers, wording)
- [x] 5. Prove it yourself. merged: content tests below
- [x] 6. Record. this entry
- [x] Done when: committed, items ticked.

## 2026-11-28 build T29
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/content-a2
- [x] 2. Starting state. fast checks pass at 848f1f3
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done fe890d5; native reader "pass with fixes": 8 must-fix (2 grammar notes, 1 missed order, 1 tile ambiguity, 4 typed variants) applied; 11 of 17 optional applied, 3 skipped (untaught words), 3 no change
- [x] 5. Prove it yourself. merged: jest and typecheck above
- [x] 6. Record. this entry; T32 planned for checks builders asked for
- [x] Done when: committed, items ticked.

## 2026-11-28 build T32
- Read: build/SKILL.md a069840
- [x] 1. Branch. nstack/content-a2
- [x] 2. Starting state. fast checks pass at 42a6e09
- [x] 3. Dispatch. builder in worktree
- [x] 4. Read the reply. done bd89dd2; speak rule red 2, comma variants red 3, testTimeout 20000
- [x] 5. Prove it yourself. merged: jest below
- [x] 6. Record. this entry
- [x] Done when: committed, items ticked.

## 2026-11-28 verify content-a2 (with content-a1)
- Read: verify/SKILL.md adc6a8a
- [x] 1. Clean tree. code at the word-order merge; head 1fa46b3 after a .nstack-only sync with main
- [x] 2. Project checks. typecheck 0, lint 0, jest 342, test:server 21, test:drive 6, drive check passed, e2e 24 passed
- [x] 3. Every acceptance criterion in scope has a passing check. content test over all 34 units (schema, word order, 2 speak, note_vi, movable-phrase orders); reader verdicts per batch (T26-T31) and a full build_sentence sweep (81 items); check-features 0
- [x] 4. Every new check bites. speak rule red 2, comma rule red 3 (T32); movable-phrase check red (flagged 9 items on existing content); broken unit file red (content-a1 verify)
- [x] 5. The real thing runs. drive check lists the new units on the track screens
- [x] 6. Every changed screen looks right. n/a: no screen code changed
- [x] 7. Nothing got weaker. Jest testTimeout raised to 20 s (T32) because component tests timed out under load twice; no assertion loosened
- [x] 8. No new warnings or errors. lint 0
- [x] 9. Access is enforced. n/a: no routes, tables or auth
- [x] Done when: all ticked. Not verified: none beyond the parked Android flows.
- Decision: content-a1 and content-a2 ship as one PR (content-a2 is stacked on content-a1; one review and one CI cycle). content-a1's review finding (missing word orders) is fixed here by the movable-phrase check.

## 2026-11-28 review content-a2 (with content-a1)
- Read: review/SKILL.md c151f88
- [x] 1. Dispatch. content-a1 reviewer at 42987b9: fix-needed (missing valid word orders in 3 items) -> fixed for all 34 units by the movable-phrase check (07c091f). content A1-A2 reviewer at c08693f: fix-needed, 1 important: the -X ours sync with main restored the branch's old speak-answer.tsx and test, undoing main's double-tap guard
- [x] 2. Second reviewer. n/a: content only
- [x] 3. Act on every finding. both files restored from origin/main (identical to main again); jest 343, e2e 24
- [x] 4. Review the fixes. small-fix exception: the fix is a restore to main's reviewed code with its test passing; no new round
- [x] Done when: no important findings open; verify passed after the fix.
- Lesson: syncing a stacked branch with a squash-merged main using `merge -X ours` silently reverts main's fixes the branch forked before. Check added: scripts/check-sync <shipped PR head>... lists files that differ from main though no own commit changed them; run it after every sync.
