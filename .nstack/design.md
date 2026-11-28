# Design
Subject: Vietnamese adults (many on budget Android phones, little confidence with apps or with English) and their children, learning their first English words in 5-10 minute sessions on a phone, often daily during a break or before bed. One thing on screen at a time, large Vietnamese-friendly type, calm and encouraging, never childish for adults; the kids track is brighter but uses the same system.
Kind: learning app (short daily sessions, phone first; web is the same app in a centred phone-width column)

## Tokens
- background #F3F6F4 (cool paper), surface #FFFFFF, text #1B2A26, muted #5A6B66 (metadata only), accent #5B3FA8 ("mực tím", the purple school ink: actions, current state, the English being taught), success #1E7A4C (correct answer), danger #B3261E (wrong answer, destructive), line #D6DED9 (borders, the grid)
- dark: background #121816, surface #1C2421, text #E8EFEC, muted #A3B2AD, accent #B9A6F2, success #6FD3A0, danger #F2A49E, line #2E3A36
- type: Be Vietnam Pro (OFL, drawn for Vietnamese diacritics) via @expo-google-fonts/be-vietnam-pro; 400 body, 600 headings and buttons, 700 page titles. Scale ratio 1.2 from 16 px: 13.3, 16, 19.2, 23, 27.6, 33.2; the English word on a card 40. Numbers tabular.
- space: 4 px base; 4, 8, 12, 16, 24, 32, 48. Radius 12 (controls), 16 (cards). Border 1 px line colour. Shadow: none; surfaces separate by colour and border.
- touch targets at least 48 px tall; primary button full width at the bottom of the screen (thumb reach).
- signature: the "vở ô ly" grid. The card that holds the English being taught sits on a faint squared grid like a Vietnamese school notebook, and the English word is written in the purple-ink accent; Vietnamese explanations sit below it in plain text colour.

## Generic check
- Rejected: a bright green owl-style mascot palette with rounded cartoon buttons (the default for language apps); replaced by paper, purple ink and the ô-ly grid that every Vietnamese learner knows from school.
- Rejected: emoji as UI icons; emoji appear only as pictures of words in the kids track (content, not chrome).
- Rejected: cards with soft shadows in rows; replaced by bordered list rows with one clear primary action per screen.

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
- `word`: id, en, vi, audio (English text to speak, defaults to en), example {en, vi} optional, picture (emoji, kids track only) optional
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
- Speech: device text-to-speech (expo-speech; Web Speech API on web) and device speech recognition; no paid APIs, no recorded audio.

### Children
- Decision: kids are 4-10 and use the app with a parent. A parent account owns child profiles; a child profile stores only a nickname and a picture choice (no email, real name, birthday or location); no ads, third-party trackers or chat anywhere in the app. Account, plan and profile management sit behind a parent gate.
