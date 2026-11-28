# Design
Subject: Vietnamese adults (many on budget Android phones, little confidence with apps or with English) and their children, learning their first English words in 5-10 minute sessions on a phone, often daily during a break or before bed. One thing on screen at a time, large Vietnamese-friendly type, calm and encouraging, never childish for adults; the kids track is brighter but uses the same system.
Kind: learning app (short daily sessions, phone first; web is the same app in a centred phone-width column)

Bar (research.md "Design bar", 2026-11-28): Duolingo (one saturated action colour, a big illustrated card per word, tactile buttons with a darker bottom edge, a coloured answer sheet with a sound), Drops (a saturated colour per topic for tile, header and background, one picture per word), Lingokids (warm, chunky, playful without noise). Owner's taste (goal.md) overrides: colourful, a colour per track, drawn colour pictures, depth, celebration. We match their polish and beat them by being Vietnamese-first: type drawn for Vietnamese, the Vietnamese gloss on every picture card, the ô-ly notebook grid, a natural voice with slow replay.

## Tokens
Colour (light; every pairing used is checked for contrast in `src/constants/theme.test.ts`):
- brand: ink #5B3FA8 (purple school ink: the app's own actions, links, focus ring), ink-deep #432C85 (button lip), ink-tint #EEE9FA
- track everyday "Đời sống": lotus #D9467A, lotus-deep #A82E5A, lotus-tint #FDE8F0
- track work "Công việc": ocean #2F6FDB, ocean-deep #1F4FA6, ocean-tint #E4EEFC
- track kids "Trẻ em": mango #F59A12 (fills and pictures only, never under text), mango-deep #A65A00, mango-tint #FFF1D9
- success #1F9D55, success-deep #15773F, success-tint #E2F6EA; danger #D93636, danger-deep #A82424, danger-tint #FDE6E6
- background #F5F6FA, surface #FFFFFF, raised #FFFFFF with shadow, text #1A2233, muted #5B6478 (metadata only), line #DDE1EA
- dark: background #10131A, surface #1A1F2B, raised #222838, text #EDF0F7, muted #A4ACBD, line #2E3546; each colour has a lighter dark-mode value (ink #B9A6F2, lotus #F07BA5, ocean #7FA8F5, mango #FFB84D, success #5FD394, danger #F28B8B) and tints at 18% over surface
- White text sits only on the -deep values (all >= 4.5:1). Track colour fills the track's header band, icon tile, progress bar and the lesson's primary button; ink is used where no track applies (home, account, profiles, premium).
Type: Be Vietnam Pro (OFL): 400 body, 600 headings and buttons, 700 titles, 800 the big numbers on result screens. Scale ratio 1.2 from 16 px: 13.3, 16, 19.2, 23, 27.6, 33.2; English word on a card 40; result number 56. Line height 1.4 body, 1.25 headings (room for stacked diacritics).
Space: 4 px base; 4, 8, 12, 16, 24, 32, 48. Radius 14 controls, 20 cards, 999 pills.
Depth: two surface levels on every screen. Pressable cards and buttons have a 4 px bottom lip in the -deep colour (line colour for neutral cards) that shrinks to 0 while pressed (the face moves down 4 px); sheets and dialogs use shadow 0 8 24 rgba(26,34,51,0.12); no borders on raised surfaces.
Icons and pictures: UI icons are Lucide (ISC) drawn in white on a track- or ink-coloured rounded tile, or in ink on neutral surfaces; never typed emoji. Pictures of words, tracks, profile avatars, empty states and milestones are Microsoft Fluent Emoji 3D (MIT) shipped as PNG files at 192 px, one style everywhere. Every concrete word has a picture; abstract words (greetings, function words) may have none and are marked so in content.
Feedback: on check, a bottom sheet in success-tint or danger-tint slides up (200 ms) with an icon, a short sound, the praise or the right answer with its play button, and Continue in success-deep or danger-deep; a right choice bounces once (scale 1 -> 1.06 -> 1, 180 ms). Progress bar in the track colour with a lighter highlight stripe grows on each right answer. Lesson and review results celebrate: a burst of ô-ly squares and petals in the track colours for 1.6 s, a count-up of words learned, a rising three-note sound; tap skips; with reduced motion, no burst and no count-up, the sound only.
Sounds: original, synthesised by a script in the repo (correct, wrong, celebrate), under 1 s each, played through expo-audio at media volume; they respect the iOS silent switch (unlike word audio, which plays in silent mode). A sound on/off switch is out of scope.
Touch targets at least 48 px; primary button full width at the bottom (thumb reach); web is a centred column of 480 px (lesson) to 640 px (home, track grid at 1280 shows two columns).
Signature: the "vở ô ly" grid. The word card sits on a faint squared grid tinted in the track colour, the English word in the track's deep colour with the picture above it and the Vietnamese gloss below; the celebration bursts ô-ly squares.

## Generic check
- Rejected: a green owl-style mascot palette (the language-app default); replaced by one colour per track drawn from Vietnamese life (lotus pink, ocean blue, mango) on a purple-ink brand.
- Rejected: purple-to-blue gradients and gradient text; colours are flat fills with tints and a darker lip.
- Rejected: emoji typed as text; pictures are Fluent Emoji 3D files and icons are Lucide.
- Rejected: rows of identical soft-shadow cards; home shows three tall track cards each in its own colour with a picture, the track screen a level path with coloured unit tiles, and lists elsewhere use grouped rows.
- Rejected: confetti in generic rainbow colours; the burst uses ô-ly squares in the track colours.
- Decision: the 2026-11-27 "paper, purple ink, no shadows" direction is replaced by this one at the owner's request (colourful, a colour per track, pictures, depth, celebration); ink and the ô-ly grid stay as the brand thread.

## Content
### Learners and levels
- Vietnamese speakers who know no English. UI and every explanation in Vietnamese (vi), English only as the content taught.
- Levels: Bắt đầu (pre-A1, "A0"), A1, A2 (CEFR). Higher levels later.
- Tracks: `everyday` (Đời sống, adults), `work` (Công việc, adults), `kids` (Trẻ em, ages 4-10 by assumption, used with a parent nearby).
- Can statements are written per unit in the content files (`goals`), e.g. "Có thể chào hỏi và nói tên mình".

### Units (planned; content files are the source of truth once written)
- everyday A0: 1 Chào hỏi, 2 Số 1-10, 3 Gia đình, 4 Đồ ăn và đồ uống, 5 Màu sắc và đồ vật
- everyday A1: 6 Giới thiệu bản thân, 7 Mua sắm và giá cả, 8 Giờ và ngày, 9 Đi lại và hỏi đường, 10 Nhà cửa
- everyday A2: 11 Ở nhà hàng, 12 Sức khỏe, 13 Thời tiết, 14 Kể chuyện hôm qua (quá khứ đơn), 15 Kế hoạch (be going to)
- work A0: 1 Chào hỏi nơi làm việc, 2 Nghề nghiệp, 3 Văn phòng và đồ dùng
- work A1: 4 Lịch và giờ làm, 5 Điện thoại và tin nhắn, 6 Phục vụ khách hàng
- work A2: 7 Họp và nêu ý kiến, 8 Phỏng vấn xin việc, 9 Báo cáo sự cố
- kids A0: 1 Con vật, 2 Màu sắc, 3 Số đếm, 4 Hoa quả, 5 Cơ thể
- kids A1: 6 Gia đình, 7 Đồ chơi, 8 Trường học
- kids A2: 9 Một ngày của em, 10 Cảm xúc
- Each unit: 6-10 new words or phrases, one short grammar or usage note in Vietnamese (A1 and up), at least 10 exercises. A word is used in an exercise only in or after the unit that introduces it.

### Item types (fields)
- `word`: id, en, vi, audio (English text to speak, defaults to en), example {en, vi} optional, picture (a Fluent Emoji 3D asset name, every track) required unless `abstract: true`
- `choose_meaning`: prompt word id; options are vi meanings (3-4), answer
- `choose_english`: prompt vi; options en (3-4), answer
- `listen_choose`: audio en; options en (3-4), answer
- `build_sentence`: prompt vi; tiles en (answer words plus 0-2 distractors), answer (ordered)
- `type_answer`: prompt vi; answer en; accepted variants
- `speak`: text en, vi; recognised speech is compared after normalising case and punctuation; fallback where recognition is missing or denied: listen, repeat aloud, then self-check
- Every exercise: id, type, hint_vi optional. Ids are stable (`<track>-<level>-u<n>-<k>`) because progress refers to them.

### Sources
- Lessons, explanations, dialogues, exercises, translations: written originally for this app (`source: original`).
- Open data only with a commercial-use licence, fetched by a pinned script and recorded in `content/SOURCES.md` (see `research.md` "Content sources").
- Speech: audio generated at build time by Kokoro-82M (Apache-2.0, two voices) for every English text, bundled; device text-to-speech only as fallback; device speech recognition for speaking. No paid APIs, no recorded human audio.
- Pictures: Microsoft Fluent Emoji 3D (MIT), fetched by a pinned script, listed in content/SOURCES.md.

### Children
- Decision: kids are 4-10 and use the app with a parent. A parent account owns child profiles; a child profile stores only a nickname and a picture choice (no email, real name, birthday or location); no ads, third-party trackers or chat anywhere in the app. Account, plan and profile management sit behind a parent gate.
