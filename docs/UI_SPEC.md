# myAmgi UI specification

The UI follows Anki's information architecture and AnkiDroid's interaction model, so anyone who knows Anki can use it
without learning anything. It is one React app (`web/`) for phone, tablet, Comet e-ink and PC. Read `ARCHITECTURE.md` first.

## Design tokens (CSS custom properties on `:root[data-theme=...]`)

| Token | light | dark | eink |
| --- | --- | --- | --- |
| `--bg` | `#FFFFFF` | `#121316` | `#FFFFFF` |
| `--surface` | `#F4F5F8` | `#1C1E23` | `#FFFFFF` |
| `--surface-2` (pressed, selected row) | `#E8EBF2` | `#272A31` | `#FFFFFF` + 3px left bar `#000` |
| `--text` | `#1B1C1F` | `#E6E7EA` | `#000000` |
| `--text-2` | `#5F6470` | `#9AA0AC` | `#000000` |
| `--border` | `#DDE1E8` | `#2C2F36` | `#000000` |
| `--primary` | `#2F6FED` | `#7AA7FF` | `#000000` |
| `--on-primary` | `#FFFFFF` | `#0B1220` | `#FFFFFF` |
| `--count-new` | `#2F6FED` | `#7AA7FF` | `#000000` |
| `--count-learn` | `#D93025` | `#FF7A70` | `#000000` |
| `--count-review` | `#1E8E3E` | `#5DD27A` | `#000000` |
| `--again` / `--hard` / `--good` / `--easy` | `#D93025` / `#B26A00` / `#1E8E3E` / `#2F6FED` | `#FF7A70` / `#F2B24A` / `#5DD27A` / `#7AA7FF` | all `#000000` |
| `--danger` | `#D93025` | `#FF7A70` | `#000000` |
| border width | 1px | 1px | 2px |
| radius | 10px | 10px | 4px |
| motion | 120ms ease-out for presses and sheet open | same | none (`* { transition: none; animation: none }`) |

Flag colours (Anki's 7, same order): red `#E25252`, orange `#EF9F45`, green `#5CC878`, blue `#5B9DF0`, pink `#E88BC4`, turquoise `#4CC9C0`, purple `#A77BE8`. In `eink` a flag is shown as its number in a black square.

Because `eink` cannot use colour, anything distinguished by colour elsewhere also carries a text label or shape there
(count columns have headers; answer buttons carry their names; the selected item has a thick left bar).

Typography: `system-ui, "Noto Sans KR", sans-serif`. Sizes 13 / 14 / 16 (body) / 18 / 22 / 28. Numbers use `font-variant-numeric: tabular-nums`.
Spacing on a 4px grid. Minimum touch target 48px (56px in `eink`). Respect `env(safe-area-inset-*)`.
Theme `auto` follows `prefers-color-scheme`; the `comet` flavor defaults to `eink`.

## App shell

- Width < 900px: top app bar (56px: title, sync button, overflow) + content + bottom tab bar (덱 / 찾아보기 / 통계 / 설정) + floating "추가" button on the deck list.
- Width ≥ 900px: left navigation rail (72px: 덱, 찾아보기, 통계, 설정, and "추가" at the top) + content; list screens become two panes (list 380–440px + detail).
- The reviewer hides the tab bar / rail and uses the whole window.
- Sync button states: idle, syncing (spinner; static "동기화 중" text in `eink`), needs sync (dot), error (`!`). Tap = sync; when not logged in it opens 설정 › 동기화.
- Dialogs are bottom sheets on phones and centred dialogs (max 480px) on wide screens. Destructive actions always confirm and name the object ("'일본어::한자' 덱과 카드 1,204장을 삭제합니다").
- Toasts for results ("가져오기 완료: 노트 1,204개"); errors that block a screen replace it with an error state, never a blank page.

## Routes

| Route | Screen |
| --- | --- |
| `#/decks` | Deck list (root). Wide: deck overview in the second pane. |
| `#/deck/:id` | Deck overview (phone). |
| `#/study/:id` | Reviewer. |
| `#/browse?q=` | Card browser. |
| `#/note/new?deck=`, `#/note/:id` | Note editor (add / edit). |
| `#/notetypes`, `#/notetype/:id` | Note types, fields, templates (large template editor). |
| `#/stats` | Official graphs page embedded. |
| `#/deck-options/:id`, `#/card-info/:id`, `#/import/...`, `#/change-notetype/...`, `#/image-occlusion/...` | Official Anki pages embedded in an iframe under the app bar (they adopt the theme through `data-bs-theme` and the `night-mode` class). |
| `#/settings`, `#/settings/sync`, `#/settings/backup`, `#/settings/about` | Preferences, sync, backups, version/diagnostics. |

## Deck list (`#/decks`)

Mirrors Anki's deck browser.

- Header row: `덱` · `새 카드` · `학습` · `복습` (three right-aligned numeric columns, 56px each).
- Row (min 52px): expand chevron if it has children (tap toggles, persisted with `setDeckCollapsed`), name indented 20px per level, counts in `--count-new` / `--count-learn` / `--count-review`; zero counts in `--text-2`. Filtered decks show their name in `--primary` (underlined in `eink`).
- Tap a row: phone → start studying that deck when anything is due, otherwise open its overview; wide → select it and show the overview pane.
- Long-press or the row's `⋮`: 학습, 이름 바꾸기, 덱 옵션, 맞춤 학습, 하위 덱 만들기, 카드 찾아보기, 내보내기, 삭제. Filtered decks add 다시 만들기 / 비우기 instead of 덱 옵션.
- Footer line: the backend's "studied today" sentence.
- "추가" button menu: 노트 추가, 덱 만들기, 필터 덱 만들기, 가져오기(.apkg · .colpkg · 텍스트/CSV).
- Empty state: "덱이 없습니다" with two buttons: 가져오기, 덱 만들기.
- Pull to refresh (phone) / F5 recomputes counts. Counts refresh whenever the screen regains focus.

## Deck overview (`#/deck/:id`)

Deck name, description (HTML from the deck, sanitized), the three counts with labels, "학습 시작" primary button (disabled with the backend's congrats/limit message when nothing is due), secondary actions: 덱 옵션, 맞춤 학습, 카드 찾아보기, 통계. For filtered decks: 다시 만들기, 비우기.

## Reviewer (`#/study/:id`)

- Top bar (48px): back, deck name, remaining counts `새 · 학습 · 복습` with the current card's queue underlined, undo, flag, overflow menu
  (노트 편집, 표시(mark), 카드 숨기기(bury card / bury note), 일시 중지(suspend card / note), 잊기(forget), 복습 날짜 지정, 카드 정보, 오디오 다시 재생, 덱 옵션, 노트 삭제).
- Card area: iframe (`/media/__amgi_frame.html`) filling the space; scrolls internally. Flag stripe on the top edge; mark star at top right.
- Bottom area before the answer: one full-width "정답 보기" button (56px). After: answer buttons each with the next interval above the label
  (`<1분` / `<10분` / `1일` / `4일` from `describeNextStates`): 다시 · 어려움 · 알맞음 · 쉬움 in `--again/--hard/--good/--easy`.
  Two-button mode (preference, default on in `comet`): 모름 (= Again) · 암기 완료 (= Good).
- Optional per-card timer per deck config; auto-advance and "show remaining count" follow Anki preferences.
- Tap zones (preference): tapping the card area shows the answer; never while text is selected or when the target is a link, button, input, audio control, or an element marked `tappable` by the deck.
- End of queue: the official congrats page, with "덱 목록으로".
- Hanja: taps on kanji are handled by the bundled Hanja tap script inside the card frame and forwarded to `hanja.lookup`.

## Card browser (`#/browse`)

Search box with Anki search syntax and a filter sheet (deck, tag, card state, flag, note type, "오늘 추가" …) that writes the query for you.
Toggle cards/notes mode. Virtualized table; columns configurable (질문, 답, 덱, 노트 유형, 만기, 간격, 용이도/난이도, 복습 횟수, 실패 횟수, 태그, 생성일, 수정일); sort by column.
Row tap = preview pane (wide) or preview screen (phone); long-press = multi-select with actions: 덱 변경, 태그 추가/제거, 깃발, 일시 중지/해제, 숨기기, 잊기, 복습 날짜 지정, 카드 위치 변경, 노트 유형 변경, 찾아 바꾸기, 내보내기, 삭제. Row colours as in Anki (suspended yellow, marked purple, flag colours).

## Note editor

Note type and deck pickers, one editor per field (rich text: bold/italic/underline, colour, cloze `[...]` with auto-numbering, attach image/audio/record, HTML source toggle), tags input with completion, duplicate warning on the first field, "카드 미리보기". Add mode keeps deck/type and sticky fields after saving.

## Settings

학습(2버튼 모드, 탭해서 넘기기, 볼륨키/리모컨, 자동 재생, 글자 크기) · 화면(테마, 줄 간격) · 동기화(AnkiWeb 로그인, 자동 동기화, 미디어 동기화, 전체 올리기/내려받기) · 백업(지금 백업, 복원, 자동 백업 개수) · 도구(데이터베이스 검사, 미디어 검사, 빈 카드 정리) · 정보(앱 버전, 빌드, UI 번들 버전, 엔진 버전, 마지막 동기화 시각, 업데이트 확인, 오류 로그 복사).
