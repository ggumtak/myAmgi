# myAmgi UI specification — "Playful" design system (2026-11-28)

One React app (`web/`) for phone, tablet, Comet e-ink and PC. Read `ARCHITECTURE.md` first.
The information architecture stays Anki's (decks → overview → reviewer, browser, editor, stats, settings).
The look follows the game-style study apps the owner picked as the reference: vivid flat colours, thick 2px outlines,
"3D" buttons and cards with a heavier bottom edge, heavy rounded type, a daily-goal ring and streak on the home screen.

Three rules decide every screen:

1. **One chunky surface per group, never a box inside a box.** A group of related things is one card
   (2px outline, heavier bottom edge). Inside it, rows are separated by 2px lines, not by more cards.
2. **Big and heavy.** Titles 900, buttons and labels 800, body 600. Nothing a user must read is smaller than 13px.
   Numbers that matter (due counts, goal %) are the largest thing on the screen.
3. **Colour means something.** Green = go / correct / review. Blue = new / selected / info. Red = again / learning / danger.
   Orange = hard / streak. Anything told by colour also has a label or shape (e-ink has no colour).

## 1. Tokens (CSS custom properties on `:root[data-theme=...]`)

| Token | light | dark | eink |
| --- | --- | --- | --- |
| `--bg` (page) | `#FFFFFF` | `#131F24` | `#FFFFFF` |
| `--surface` (cards, sheets) | `#FFFFFF` | `#131F24` | `#FFFFFF` |
| `--surface-2` (inputs, pressed, selected row, tracks) | `#F7F7F7` | `#202F36` | `#FFFFFF` |
| `--line` (all outlines and dividers) | `#E5E5E5` | `#37464F` | `#000000` |
| `--line-strong` (bottom edge of neutral cards/buttons) | `#D4D4D4` | `#2B3940` | `#000000` |
| `--text` | `#3C3C3C` | `#F1F7FB` | `#000000` |
| `--text-2` | `#777777` | `#A9B8C0` | `#000000` |
| `--text-3` (placeholders, zero counts, inactive tabs) | `#AFAFAF` | `#6B7F8A` | `#000000` |
| `--green` / `--green-edge` / `--green-soft` / `--green-text` | `#58CC02` / `#46A302` / `#D7FFB8` / `#3F9400` | `#93D333` / `#79B933` / `rgba(147,211,51,.16)` / `#93D333` | `#000` / `#000` / `#FFF` / `#000` |
| `--blue` / `--blue-edge` / `--blue-soft` / `--blue-text` | `#1CB0F6` / `#1899D6` / `#DDF4FF` / `#1899D6` | `#49C0F8` / `#3A9BC9` / `rgba(73,192,248,.16)` / `#49C0F8` | same as green row |
| `--red` / `--red-edge` / `--red-soft` / `--red-text` | `#FF4B4B` / `#D33131` / `#FFDFE0` / `#E53838` | `#EE5555` / `#C33F3F` / `rgba(238,85,85,.16)` / `#FF7070` | same |
| `--orange` / `--orange-edge` / `--orange-soft` / `--orange-text` | `#FF9600` / `#CD7900` / `#FFF0D5` / `#D97F00` | `#FFAB33` / `#D98A1B` / `rgba(255,171,51,.16)` / `#FFAB33` | same |
| `--purple` / `--pink` / `--yellow` (deck tiles, mark star) | `#CE82FF` / `#FF86D0` / `#FFC800` | same | `#000` |
| `--on-color` (text on a filled colour button) | `#FFFFFF` | `#131F24` | `#FFFFFF` |
| `--backdrop` | `rgba(0,0,0,.45)` | `rgba(0,0,0,.6)` | `rgba(0,0,0,.35)` |

Semantic aliases (keep these names; screens use them, never raw hex):
`--primary` = green, `--primary-edge`, `--primary-soft`, `--on-primary`;
`--count-new` = `--blue-text`, `--count-learn` = `--red-text`, `--count-review` = `--green-text`;
`--again` = red, `--hard` = orange, `--good` = green, `--easy` = blue (each with `-edge`, `-soft`, `-text`);
`--danger` = red, `--warn` = orange, `--ok` = green; `--selected` = blue.
Flags (Anki's 7, same order): `#FF4B4B`, `#FF9600`, `#58CC02`, `#1CB0F6`, `#FF86D0`, `#2BD9C5`, `#CE82FF`; in `eink` a flag is its number in a black square.
Heatmap: `--heat-0..4` = `--surface-2`/`#E5E5E5`, `#D7FFB8`, `#A5ED6E`, `#58CC02`, `#46A302` (dark: `#202F36`, `#2F4A1E`, `#4E7A22`, `#79B933`, `#B8F05A`; eink: white → black in 5 greys).

Shape and size:

- `--outline: 2px` everywhere (also `eink`). `--edge: 4px` = the heavier bottom border of chunky cards and buttons (`eink`: 4px too).
- Radius: `--r-sm: 12px`, `--r-md: 16px` (buttons, inputs, list cards), `--r-lg: 20px` (big cards, dialogs), `--r-xl: 24px` (sheets), pill `999px`. `eink`: 6 / 8 / 10 / 12.
- No box-shadows except the floating add button and toasts (`0 4px 0 rgba(0,0,0,.12)` style hard shadow, none in `eink`). No blur, no gradients, no glow.
- Spacing on a 4px grid; screen gutter 16px (phone), 24px (≥840px). Minimum touch target 48px (56px `eink`).
- Motion: press = `transform: translateY(2px)` with the bottom edge shrinking 4px → 2px (60ms); sheets 180ms ease-out; progress bars 300ms. `eink`: none (`* { transition: none; animation: none }`). Respect `prefers-reduced-motion`.

Typography: bundled **Pretendard Variable** (npm `pretendard`, OFL) first, then `"Noto Sans KR", system-ui, sans-serif`.
Scale: 12 (tab labels only) / 13 / 15 (body) / 17 / 20 / 24 / 32 / 44 (hero numbers). Weights: body 600, secondary 600–700, labels and buttons 800, titles and big numbers 900.
Buttons and section labels have `letter-spacing: .01em`; titles `-.02em`. `font-variant-numeric: tabular-nums` on every number. `word-break: keep-all`.

## 2. Primitives (global classes in `styles/main.css`; screens compose these and add layout only)

- **Button** `.amgi-btn` (height 50px, radius 16, weight 800, 15px, `border-bottom: var(--edge) solid <edge>`; `:active` moves down 2px and the edge becomes 2px; `:disabled` = `--surface-2` fill, `--text-3` text, `--line` edge, no press).
  Variants: `.amgi-btn-primary` (green fill, `--on-color` text), `.amgi-btn-blue`, `.amgi-btn-danger` (red fill), `.amgi-btn-secondary` (surface fill, 2px `--line` outline + `--line-strong` edge, `--blue-text` text), `.amgi-btn-ghost` (no outline/edge, `--text-2`), sizes `.amgi-btn-lg` (56px, 17px), `.amgi-btn-sm` (40px, 13px, edge 3px), `.amgi-btn-block` (100% width), `.amgi-btn-icon` (48×48, ghost by default; icon buttons in bars have no outline).
  `eink`: primary/blue/danger = black fill + white text; secondary = white + black outline; ghost = underlined when it is the only affordance.
- **Card** `.amgi-card` (surface, 2px `--line` outline, bottom edge 4px `--line`, radius 20, padding 16). `.amgi-card-flat` (no heavier edge, for nested or dense places). `.amgi-card-pressable` (press animation, used for deck cards). Rows inside a card: `.amgi-row` (min-height 56px, padding 0 16px, 2px `--line` top divider between rows).
- **Section label** `.amgi-section-label` (13px/800, `--text-2`, uppercase not used, margin 20px 4px 8px).
- **Input / select / textarea** `.amgi-input` (48px, `--surface-2` fill, 2px `--line`, radius 16, 15px/600; focus = 2px `--blue` outline colour, no glow). Search field = input with a leading icon.
- **Chip** `.amgi-chip` (32px pill, 2px `--line`, 13px/800, `--text-2`); selected `[aria-pressed=true]` / `.is-active` = `--blue-soft` fill, `--blue` outline, `--blue-text`. Count chips `.amgi-chip-new|learn|review` = soft fill + matching text colour.
- **Segmented control** `.amgi-seg` (2px `--line` outline pill container, items 36px; active item = `--blue-soft` + `--blue-text`, 800).
- **Switch** `.amgi-switch` (52×32, track `--line`; on = `--green`; knob white with 2px outline). `eink`: on = black track + "켬" visible via knob position and a check mark.
- **Progress bar** `.amgi-progress` (height 16px, radius pill, track `--line`/`--surface-2`; fill `--green` with a lighter 4px inner highlight strip at the top (`rgba(255,255,255,.25)`); size `.amgi-progress-sm` 10px without highlight). `eink`: 2px black outline, black fill.
- **Ring** (daily goal): SVG, 72px, 10px stroke, track `--line`, value `--green`, round caps, % in the centre 15px/900.
- **Deck tile** `.amgi-tile` (40px square, radius 12, filled with one of blue/red/green/orange/purple/pink chosen by a stable hash of the root deck name; shows the first grapheme of the deck name, white 900). 56px variant on the overview. `eink`: white with black outline, black letter. This replaces the keyword-guessing emblems.
- **Top bar** `.amgi-topbar` (56px + safe-area top, `--bg`, 2px `--line` bottom border; title 20px/900; back button = ghost icon button).
- **Bottom tab bar** `.amgi-bottomnav` (64px + safe-area bottom, 2px `--line` top border, 4 tabs: 학습 / 찾아보기 / 통계 / 설정; inactive `--text-3`, active = `--blue-text` label and the icon sitting in a 44×36 rounded rect with `--blue-soft` fill and 2px `--blue` outline; labels 12px/800). `eink`: active = black fill rect with white icon.
- **Rail** (≥840px) `.amgi-rail` (88px wide, same four items vertically with the same active style, "추가" as a `.amgi-btn-blue` square 56px at the top).
- **Floating add button** `.amgi-fab` (phone home only): 56×56, radius 18, blue fill with blue edge, white plus; bottom-right above the tab bar (left when `study.leftHanded`).
- **Sheet / dialog** (`SheetOrDialog`): phone = bottom sheet, radius 24 top corners, 2px `--line` top outline, grabber 40×5; ≥840px = centred dialog max 480px, radius 20, 2px outline + 4px bottom edge. Title 20px/900. Footer buttons full-width stacked on phone (primary on top), right-aligned row on wide. Destructive actions confirm and name the object.
- **Action menu** rows: 56px, icon 22px in `--text-2`, label 15px/800, optional description 13px/600 `--text-2`; destructive rows `--red-text`.
- **Toast**: bottom-centre above the tab bar, `#3C3C3C` fill (dark: `#F1F7FB` with dark text), white 15px/800, radius 16, leading icon coloured by kind. `eink`: white with black outline.
- **Empty / error / loading states**: centred column, 24px/900 title, 15px/600 `--text-2` body, one primary + one secondary button. Loading = three bouncing dots in `--line` (static "불러오는 중…" text in `eink`). Errors keep "오류 로그 복사".

Breakpoints (one source of truth: CSS custom media in comments + `web/src/ui/breakpoints.ts`): phone `< 840px` (bottom tabs), `≥ 840px` rail, `≥ 1024px` two-pane lists. No other breakpoints.

## 3. App shell

- Phone: top bar + content + bottom tab bar. Home top bar: wordmark "myAmgi" (22px/900, `--green-text`) left; right = streak chip (flame icon + days, `--orange-text`, 15px/900; hidden at 0), sync icon button, overflow. Other tabs: page title + sync icon button.
- ≥840px: rail + content (max-width 720px single column, centred); ≥1024px list screens become two panes (list 400–440px + detail).
- The reviewer, editor, note types, deck options and embedded Anki pages hide the tab bar / rail and have their own top bar with a back button.
- Sync button states: idle, syncing (spinning icon; static "동기화 중" chip in `eink`), needs attention (orange dot), error (red `!` badge). The background-sync strip under the top bar is a `--blue-soft` bar with 13px/800 text and a "중단" ghost button.

Routes are unchanged (see `App.tsx`).

## 4. Home / deck list (`#/decks`)

Top to bottom, 16px gutters, 12px between blocks:

1. **Goal card** (`.amgi-card`): ring (today done ÷ (done + remaining)) left; right column: "오늘의 목표" 17px/900, then "5 / 52장 · 47장 남음" 13px/700 `--text-2`; under both, a row of three count chips: `새 32` (blue), `학습 4` (red), `복습 11` (green). All done → ring full with a check, title "오늘 학습 완료!", body = the backend's studied-today sentence. Nothing due and nothing studied → ring empty, "오늘은 쉬는 날" and no percent.
2. **Start button**: `.amgi-btn-primary.amgi-btn-lg.amgi-btn-block` "학습 시작" (same target deck logic as before). Disabled when nothing is due.
3. **"내 덱"** section label with "덱 N개" on the right; a search field appears above the list when there are 6 or more decks.
4. **Deck cards**, one `.amgi-card.amgi-card-pressable` per root deck:
   - Row 1: deck tile, name (17px/900, one line, ellipsis), due pill on the right (`--blue` fill, `--on-color` text, 15px/900, min-width 40px, total of new+learn+review; when 0: `--surface-2` fill with a `--text-3` check icon), then the overflow `⋮` (ghost icon button 40px).
   - Row 2: counts as text `새 15 · 학습 1 · 복습 5` (13px/800, each in its count colour, zero in `--text-3`) on the left and, when the deck has children, an expand chevron button on the right (40px target).
   - Row 3: `.amgi-progress-sm` in the tile colour = share of the deck already introduced (`1 − new_uncapped ÷ total_including_children`), no label; hidden for empty decks.
   - Expanded children render inside the same card under a 2px divider: rows of 48px (indent 16px per level, name 15px/700, the three counts as 13px/800 coloured numbers in fixed 32px columns, small chevron if it has its own children). No tiles, no nested cards.
   - Filtered decks: name in `--blue-text` with a small "맞춤" chip.
   - Tap = the existing behaviour (phone: study when something is due, otherwise overview; ≥1024px: select and show the overview pane; selected card = `--blue` outline and `--blue-soft` fill). Long-press or `⋮` = the existing action menu.
5. Empty collection: "아직 덱이 없어요" + 가져오기 (primary) + 덱 만들기 (secondary).

Tablet ≥1024px: left pane = blocks 1–4, right pane = the deck overview of the selected deck.
Pull to refresh on phone; counts refresh when the screen regains focus (quietly, no layout shift).

## 5. Deck overview (`#/deck/:id`)

One column, 16px gutters:

- Header: 56px deck tile, name 24px/900, "전체 22장" 13px/700 `--text-2`, deck options as a ghost icon button on the right. Description (sanitised HTML) under it when present.
- Three stat tiles in a row (`.amgi-card-flat`, equal width): label 13px/800 in the count colour (새 카드 / 학습 중 / 복습), number 32px/900 in the same colour (zero in `--text-3`).
- `.amgi-btn-primary.amgi-btn-lg.amgi-btn-block` "학습 시작 · 21장"; when nothing is due, a `--green-soft` congratulation box with the backend message instead.
- "숙련도" block: one 16px segmented pill bar (new blue, learning red, young orange, mature green, 2px gaps) with a legend of four dot+label+number items wrapping under it.
- "도구" section label, then a 2-column grid of `.amgi-btn-secondary` buttons with leading icons: 맞춤 학습, 노트 추가, 카드 찾아보기, 내보내기, 설명 편집 (filtered decks: 다시 만들기, 비우기).

## 6. Reviewer (`#/study/:id`)

Full window, no tab bar.

- **Top bar** (56px): close `✕` (ghost icon button) · session progress bar (`.amgi-progress`, done ÷ (done + remaining), fills the row) · combo chip (flame + consecutive non-"again" answers, `--orange-text` 15px/900, shown from 2, small bounce on increase) · undo · overflow `⋮`.
  Overflow: 노트 편집, 깃발, 표시(mark), 필기장, 오디오 다시 재생, 카드 숨기기, 일시 중지, 잊기, 복습 날짜 지정, 카드 정보, 덱 옵션, 2버튼/4버튼 전환, 키보드 단축키, 노트 삭제.
- **Info row** (28px, under the bar): deck name 13px/800 `--text-3` left (ellipsis); right = remaining counts `15 · 1 · 5` in count colours 13px/900 with the current card's queue underlined (`eink`: prefixed 새/학/복).
- **Card**: `.amgi-card` filling the remaining space with 12px side margins (max-width 820px centred), radius 22, bottom edge 5px; the card iframe fills it. Flag = 6px coloured stripe along the top inside the outline; mark = yellow star top-right; timer and audio pills float bottom-left inside the card.
  Card frame defaults (`card-frame.html`): page background = `--surface`, text = `--text`, content **vertically centred when shorter than the frame** (flex column with `margin: auto` on the content so long cards still scroll from the top), base font 22px scaled by `study.fontScale`, the answer divider `hr#answer` = 2px dashed `--line`. Deck template CSS still wins.
- **Answer bar** (bottom, safe-area aware, 12px side padding, 8px gaps):
  - Before the answer: one `.amgi-btn-primary.amgi-btn-lg.amgi-btn-block` "정답 보기" (58px).
  - After, 4-button mode: four equal buttons 62px, radius 14, filled red / orange / green / blue with their edges, label 15px/900 on top and the next interval 12px/800 under it (`<1분`, `10분`, `3일`), text `--on-color`.
  - After, 2-button mode (default): `모름` (red) and `암기 완료` (green), each 64px, label 17px/900 + interval; order flips with `study.leftHanded`.
  - `eink`: buttons white with black outline + edge and black text; the "good" action (알맞음 / 암기 완료 / 정답 보기) is black-filled.
- **End of queue**: centred column — big green check in a `--green-soft` circle (96px), "오늘 학습 완료!" 24px/900, the backend congrats text, chips with today's count / time, then "덱 목록으로" (primary) and "맞춤 학습" (secondary).
- Keyboard, volume keys, remote, tap zones, hanja taps: unchanged behaviour.

## 7. Card browser (`#/browse`)

- Search field (leading icon) with the cards/notes `.amgi-seg` and a "선택" ghost button on one row (wraps to two rows under 400px).
- Filter chips row (horizontal scroll, `.amgi-chip` with chevrons): 덱, 상태, 깃발, 태그, 노트 유형, 오늘 추가.
- Result bar: "62장" 13px/800 `--text-2` left, sort button (ghost, 13px/800) right.
- Rows (flat, 2px dividers, no cards; min 64px, padding 12px 16px): line 1 = question 15px/800 (one line), line 2 = answer 13px/600 `--text-2` (one line); right column = deck 12px/700 `--text-3` and due/state 12px/800. Flag = 4px coloured bar on the left edge; suspended = `--orange-soft` row fill + "중지" chip; marked = yellow star; selected (multi-select) = `--blue-soft` fill with a check box.
- Multi-select action bar: chunky bar above the tab bar with the count and the actions as icon+label buttons (horizontal scroll), destructive last.
- ≥1024px: list left, preview pane right (card frame in a `.amgi-card`, front/back `.amgi-seg`, meta rows under it).

## 8. Note editor, note types, deck options

- Own top bar: back · title · primary action as `.amgi-btn-primary.amgi-btn-sm` ("저장" / "추가"), secondary ("미리보기") as `.amgi-btn-secondary.amgi-btn-sm`.
- Editor: deck and note type pickers as two inputs side by side; formatting toolbar = a horizontally scrolling row of `.amgi-btn-secondary.amgi-btn-sm` icon buttons; each field = `.amgi-card-flat` with a 13px/800 label row (field name left, 고정 / HTML toggles as chips right) and the editable area below (17px/600, min-height 72px; focus = `--blue` outline); warnings as an `--orange-soft` strip with 13px/800 `--orange-text`; tags field last.
- Note type list: one `.amgi-card` with rows (name 15px/800, "노트 55개 · 필드 2개 · 카드 1장" 13px/600 `--text-2`, overflow button). Note type editor keeps its tabs as `.amgi-seg`.
- Deck options: groups as `.amgi-card` with rows; number steppers = `−` / value / `+` built from `.amgi-btn-secondary.amgi-btn-sm` (40px) around a 64px input; presets as chips.

## 9. Statistics (`#/stats`)

- Deck scope as chips (전체 덱 / 덱 선택).
- "오늘" card: four stat tiles in a 2×2 grid (`.amgi-card-flat`): label 13px/800 `--text-2`, value 24px/900, sub 12px/700 `--text-3`.
- Heatmap card with the streak chips (오늘 / 연속 / 최장) and `--heat-*` cells (11px squares, 3px radius, 3px gap).
- Other charts: bars in `--blue` / `--green` / `--orange` / `--red` with 6px rounded tops, 2px `--line` axes, 12px/700 `--text-3` axis labels, no gridline clutter.

## 10. Settings (`#/settings`)

Groups are `.amgi-card` with `.amgi-row`s (title 15px/800, description 13px/600 `--text-2`, control on the right): 동기화 · 학습 · 화면 · 백업 · 도구 · 정보.
Theme picker = four tiles (자동 / 밝음 / 어둠 / 흑백) as `.amgi-card-flat` with a mini preview; selected = `--blue` outline + `--blue-soft` fill.
Sync card: account state, last sync time, primary "지금 동기화" / "AnkiWeb 로그인", secondary actions in an overflow.
Info group: app version and build, UI bundle version, engine version, last sync, last update check, "업데이트 확인", "오류 로그 복사".

## 11. E-ink (`data-theme="eink"`, default on the `comet` flavor)

Pure `#000` on `#FFF`, 2px black outlines, 4px bottom edges kept (they read well on e-ink), no animation, no shadows, no colour-only meaning:
count columns and chips carry their labels (새 / 학습 / 복습), the selected item is black-filled or has a thick left bar, progress fills are black, flags are numbers in black squares, the answer buttons carry their names, and the single most likely action on a screen is black-filled. Touch targets 56px.
