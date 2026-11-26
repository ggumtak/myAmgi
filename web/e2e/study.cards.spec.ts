// Reviewer card content against the real host: audio, type-in-the-answer, MathJax,
// cloze, long cards, taps, keyboard/remote keys, huge and throwing templates,
// custom scheduling.
import { expect, test, type Page } from '@playwright/test';
import { setPrefs, shot } from './helpers';
import {
  addMedia,
  addNote,
  call,
  cardFrame,
  clearPlays,
  createDeck,
  createNotetype,
  getCard,
  installPlaySpy,
  openStudy,
  plays,
  reviewLogs,
  setDeckOptions,
  shownCardId,
  showAnswer,
  stockNotetypeId,
  uniq,
  waitRendered,
  wav,
} from './study.helpers';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await setPrefs(request, { theme: 'light', twoButtons: false, tapToShowAnswer: true });
});
test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'auto', tapToShowAnswer: null });
  await call(request, 'setConfigString', { key: 3, value: '', undoable: false });
});

const frame = (page: Page) => page.frameLocator('[data-testid="card-frame"]');

test('audio: question sounds autoplay in order, answer sounds on flip, replay, play buttons', async ({ page, request }) => {
  await installPlaySpy(page);
  const deckId = await createDeck(request, uniq('e2e::오디오'));
  const a = await addMedia(request, 'e2e_a.wav', wav());
  const b = await addMedia(request, 'e2e_b.wav', wav());
  const c = await addMedia(request, 'e2e_c.wav', wav());
  const basic = await stockNotetypeId(request, 'basic');
  await addNote(request, deckId, basic, [`소리 [sound:${a}][sound:${b}]`, `답 [sound:${c}]`]);
  await openStudy(page, deckId);
  await expect.poll(() => plays(page)).toEqual([a, b]);
  // Anki's replay buttons in the card.
  await expect(frame(page).locator('.replay-button')).toHaveCount(2);
  await clearPlays(page);
  await frame(page).locator('.replay-button').nth(1).click();
  await expect.poll(() => plays(page)).toEqual([b]);
  // A play button is not a tap on the card.
  await expect(page.getByTestId('study')).toHaveAttribute('data-phase', 'question');

  await clearPlays(page);
  await showAnswer(page);
  // The engine renders {{FrontSide}} with its sounds, so the answer side's tags are [a, b, c] (as in Anki).
  await expect.poll(() => plays(page)).toEqual([a, b, c]);

  // R replays question tags + answer tags (deck option "skip question when replaying answer" off), like aqt replay_audio.
  await page.waitForTimeout(400);
  await clearPlays(page);
  await page.keyboard.press('r');
  await expect.poll(() => plays(page)).toEqual([a, b, a, b, c]);
  await page.waitForTimeout(300);
  await clearPlays(page);
  await page.getByTestId('study-more').click();
  await page.getByTestId('act-replay').click();
  await expect.poll(() => plays(page)).toEqual([a, b, a, b, c]);
});

test('audio: deck option "don\'t play audio automatically" is respected', async ({ page, request }) => {
  await installPlaySpy(page);
  const deckId = await createDeck(request, uniq('e2e::무음'));
  await setDeckOptions(request, deckId, { autoplay: false });
  const a = await addMedia(request, 'e2e_q.wav', wav());
  await addNote(request, deckId, await stockNotetypeId(request, 'basic'), [`[sound:${a}]`, 'b']);
  await openStudy(page, deckId);
  await page.waitForTimeout(500);
  expect(await plays(page)).toEqual([]);
  await page.keyboard.press('r');
  await expect.poll(() => plays(page)).toEqual([a]);
});

test('type in the answer: input on the question, engine comparison on the answer, Enter flips', async ({ page, request }, info) => {
  const deckId = await createDeck(request, uniq('e2e::입력'));
  const typing = await stockNotetypeId(request, 'typing');
  await addNote(request, deckId, typing, ['일본의 수도', '東京']);
  await openStudy(page, deckId);
  const input = frame(page).locator('#typeans');
  await expect(input).toBeVisible();
  await input.fill('東都');
  await input.press('Enter');
  await waitRendered(page, 'answer');
  const cmp = frame(page).locator('code#typeans');
  await expect(cmp).toBeVisible();
  await expect(cmp.locator('.typeGood').first()).toContainText('東');
  await expect(cmp.locator('.typeBad, .typeMissed').first()).toBeVisible();
  await shot(page, `study-typeans-${info.project.name}`);
});

test('MathJax and cloze render like Anki', async ({ page, request }) => {
  const deckId = await createDeck(request, uniq('e2e::수식'));
  const cloze = await stockNotetypeId(request, 'cloze');
  await addNote(request, deckId, cloze, ['{{c1::서울}}은 수도이다. \\(x^2 + y^2\\)', '']);
  await openStudy(page, deckId);
  await expect(frame(page).locator('.cloze')).toContainText('[...]');
  await expect(frame(page).locator('mjx-container').first()).toBeVisible({ timeout: 15_000 });
  await showAnswer(page);
  await expect(frame(page).locator('.cloze')).toContainText('서울');
  await expect(frame(page).locator('mjx-container').first()).toBeVisible();
  const cls = await cardFrame(page).evaluate(() => document.body.className);
  expect(cls).toMatch(/^card card1/);
});

test('long card scrolls inside the frame while the buttons stay fixed', async ({ page, request }, info) => {
  const deckId = await createDeck(request, uniq('e2e::긴카드'));
  const long = Array.from({ length: 150 }, (_, i) => `<p>줄 ${i + 1} 長い文章のテスト</p>`).join('');
  await addNote(request, deckId, await stockNotetypeId(request, 'basic'), ['긴 질문', long]);
  await openStudy(page, deckId);
  await showAnswer(page);
  const vh = page.viewportSize()!.height;
  const bar = await page.getByTestId('answer-good').boundingBox();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(vh);
  const metrics = await cardFrame(page).evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  expect(metrics.h).toBeGreaterThan(metrics.vh * 2);
  // Arrow down / remote scroll the card.
  const before = await cardFrame(page).evaluate(() => scrollY);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => cardFrame(page).evaluate(() => scrollY)).toBeGreaterThan(before);
  await shot(page, `study-long-${info.project.name}`);
});

test('tap to flip: not on links, not with a selection, yes on the background', async ({ page, request }) => {
  const deckId = await createDeck(request, uniq('e2e::탭'));
  const nt = await createNotetype(request, {
    qfmt: '<div id=word>{{Front}}</div><a id=lnk href="#x" onclick="return false">링크</a><span class="tappable" id=tp>탭 영역</span><div style="height:300px"></div>',
    afmt: '{{FrontSide}}<hr id=answer>{{Back}}',
  });
  await addNote(request, deckId, nt, ['選択できる単語', '답']);
  await openStudy(page, deckId);
  await frame(page).locator('#lnk').click();
  await frame(page).locator('#tp').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('study')).toHaveAttribute('data-phase', 'question');
  // Select the word (owner looks words up), then click: no flip.
  // Select the word as a long-press would, then tap: the tap only dismisses the selection.
  await cardFrame(page).evaluate(() => getSelection()!.selectAllChildren(document.getElementById('word')!));
  expect((await cardFrame(page).evaluate(() => String(getSelection()))).length).toBeGreaterThan(0);
  await frame(page).locator('#word').click();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('study')).toHaveAttribute('data-phase', 'question');
  await cardFrame(page).evaluate(() => getSelection()!.removeAllRanges());
  await frame(page).locator('body').click({ position: { x: 20, y: 250 } });
  await waitRendered(page, 'answer');
  // Tapping the answer does nothing.
  await frame(page).locator('body').click({ position: { x: 20, y: 250 } });
  await page.waitForTimeout(300);
  await expect(page.getByTestId('study')).toHaveAttribute('data-phase', 'answer');
});

test('keyboard and remote keys: Space, digits, synthesized AudioVolumeDown / AudioVolumeUp', async ({ page, request }) => {
  const deckId = await createDeck(request, uniq('e2e::키'));
  const basic = await stockNotetypeId(request, 'basic');
  for (let i = 0; i < 3; i++) await addNote(request, deckId, basic, [`키 ${i}`, `답 ${i}`]);
  await openStudy(page, deckId);
  // Space shows the answer, 3 = Good.
  let cid = await shownCardId(page);
  await page.keyboard.press(' ');
  await waitRendered(page, 'answer');
  await page.keyboard.press('3');
  await expect.poll(async () => (await reviewLogs(request, cid)).map((r) => r.buttonChosen)).toEqual([3]);
  await waitRendered(page, 'question');

  // Volume down as the Android shell delivers it (a DOM keydown): flip, then Good.
  const volume = (key: string) => page.evaluate((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })), key);
  cid = await shownCardId(page);
  await volume('AudioVolumeDown');
  await waitRendered(page, 'answer');
  await volume('AudioVolumeDown');
  await expect.poll(async () => (await reviewLogs(request, cid)).map((r) => r.buttonChosen)).toEqual([3]);
  await waitRendered(page, 'question');

  // Volume up: flip, then Again. Sent while the card frame has focus (forwarded by the frame).
  cid = await shownCardId(page);
  await frame(page).locator('body').evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'AudioVolumeUp', bubbles: true })));
  await waitRendered(page, 'answer');
  await frame(page).locator('body').evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'AudioVolumeUp', bubbles: true })));
  await expect.poll(async () => (await reviewLogs(request, cid)).map((r) => r.buttonChosen)).toEqual([1]);

  // With the pref off, volume keys are left to the system.
  await setPrefs(request, { volumeKeys: false });
  await page.reload();
  await waitRendered(page, 'question');
  await volume('AudioVolumeDown');
  await page.waitForTimeout(300);
  await expect(page.getByTestId('study')).toHaveAttribute('data-phase', 'question');
  await page.keyboard.press('PageDown');
  await waitRendered(page, 'answer');
  await setPrefs(request, { volumeKeys: null });
});

test('500 KB template with a throwing script renders; the chrome keeps working', async ({ page, request }, info) => {
  const deckId = await createDeck(request, uniq('e2e::큰템플릿'));
  const filler = Array.from({ length: 5000 }, (_, i) => `<div class="k${i % 50}" data-i="${i}">漢字 ${i} 한자 설명 텍스트 반복</div>`).join('\n');
  const script = `<script>var big = ${JSON.stringify('x'.repeat(200_000))}; document.getElementById('ok').textContent = 'script ran ' + big.length;</script>`;
  const qfmt = `<div id=ok></div><div id=front>{{Front}}</div><div style="display:none">${filler}</div>${script}<script>throw new Error('덱 스크립트 실패 boom');</script>`;
  expect(Buffer.byteLength(qfmt)).toBeGreaterThan(500_000);
  const nt = await createNotetype(request, { qfmt, afmt: '{{FrontSide}}<hr id=answer>{{Back}}<script>onUpdateHook.push(() => { throw new Error("hook boom"); })</script>' });
  const basic = await stockNotetypeId(request, 'basic');
  await addNote(request, deckId, nt, ['큰 카드', '뒷면']);
  await addNote(request, deckId, basic, ['다음 카드', '답']);
  await openStudy(page, deckId);
  await expect(frame(page).locator('#ok')).toHaveText('script ran 200000');
  await expect(page.getByTestId('script-error')).toBeVisible();
  await shot(page, `study-script-error-${info.project.name}`);
  await page.getByTestId('script-error').click();
  await expect(page.getByTestId('script-error-text')).toContainText('boom');
  await page.getByTestId('script-error-sheet').getByRole('button', { name: '닫기' }).click();
  const cid = await shownCardId(page);
  await showAnswer(page);
  await page.getByTestId('answer-good').click();
  await expect.poll(async () => (await reviewLogs(request, cid)).length).toBe(1);
  await waitRendered(page, 'question');
  await expect(frame(page).locator('#qa')).toContainText('다음 카드');
});

test('custom scheduling (cardStateCustomizer) runs through reviewer.js and its states are used', async ({ page, request }) => {
  // Config string key CARD_STATE_CUSTOMIZER (3): put custom data on the Good state.
  await call(request, 'setConfigString', { key: 3, value: 'customData.good.e2e = 7;', undoable: false });
  try {
    const deckId = await createDeck(request, uniq('e2e::커스텀'));
    await addNote(request, deckId, await stockNotetypeId(request, 'basic'), ['커스텀', '답']);
    await openStudy(page, deckId);
    const cid = await shownCardId(page);
    await showAnswer(page);
    await page.getByTestId('answer-good').click();
    await expect.poll(async () => (await getCard(request, cid)).customData).toContain('"e2e":7');
  } finally {
    await call(request, 'setConfigString', { key: 3, value: '', undoable: false });
  }
});
