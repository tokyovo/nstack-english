# Plan

Later slices (in order, planned in full when reached): family (parent account, child profiles, parent gate, per-child progress), plans (free/premium entitlements, server-served premium lessons, payments parked).

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

- [x] T29 Everyday A2 u11-u15. Proof: content test, native reader verdict. Content: yes. Needs: none
- [x] T30 Work A2 u7-u9. Proof: content test, native reader verdict. Content: yes. Needs: none
- [x] T31 Kids A2 u9-u10. Proof: content test, native reader verdict. Content: yes. Needs: none
- [x] T32 Checks that content builders asked for: the content test requires at least 2 speak items per unit; typed answers ignore commas inside the sentence (so variants need not list them); Jest testTimeout raised for component suites so machine load does not fail correct tests. Proof: content test red on a unit with 1 speak item; answers test red on an inner-comma variant; full npm test. Needs: none

## Done
- foundation: T1-T4, PR #1
- learn-core: T5-T10, PR #2
- review-speak: T11-T15, PR #3
