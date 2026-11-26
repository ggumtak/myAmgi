// Reviewer (#/study/:id) against the real host: sessions, engine-verified outcomes, actions.
import { expect, test } from '@playwright/test';
import { setPrefs, shot, THEMES } from './helpers';
import {
  addNote,
  call,
  cardFrame,
  createDeck,
  getCard,
  noteTags,
  openStudy,
  queueFor,
  reviewLogs,
  shownCardId,
  showAnswer,
  stockNotetypeId,
  uniq,
  waitRendered,
} from './study.helpers';

test.describe.configure({ mode: 'serial' });

test.afterAll(async ({ request }) => {
  await setPrefs(request, { theme: 'auto', twoButtons: null });
});

async function smallDeck(request: Parameters<typeof createDeck>[0], n = 3, prefix = '학습') {
  const deckId = await createDeck(request, uniq(`e2e::${prefix}`));
  const basic = await stockNotetypeId(request, 'basic');
  const notes = [];
  for (let i = 0; i < n; i++) notes.push(await addNote(request, deckId, basic, [`질문 ${i + 1} 日本`, `정답 ${i + 1} にほん`]));
  return { deckId, notes };
}

test('4-button session: intervals from the engine, answers recorded, congrats at the end', async ({ page, request }, info) => {
  await setPrefs(request, { theme: 'light', twoButtons: false });
  const { deckId, notes } = await smallDeck(request, 2);
  await openStudy(page, deckId);
  await expect(cardFrame(page).locator('#qa')).toContainText('질문');
  await expect(page.getByTestId('study-counts').locator('[data-count="new"]')).toHaveClass(/is-active/);
  await shot(page, `study-question-light-${info.project.name}`);

  for (let i = 0; i < 2; i++) {
    const cid = await shownCardId(page);
    expect(notes.flatMap((n) => n.cardIds)).toContain(cid);
    // The labels the UI shows are the engine's describeNextStates of the queued states.
    const q = await queueFor(request, deckId);
    expect(q.cards[0].card!.id).toBe(cid);
    const labels = (await call(request, 'describeNextStates', q.cards[0].states!)).vals;
    await showAnswer(page);
    await expect(page.getByTestId('answer-again')).toHaveAttribute('data-interval', labels[0]);
    await expect(page.getByTestId('answer-hard')).toHaveAttribute('data-interval', labels[1]);
    await expect(page.getByTestId('answer-good')).toHaveAttribute('data-interval', labels[2]);
    await expect(page.getByTestId('answer-easy')).toHaveAttribute('data-interval', labels[3]);
    if (i === 0) await shot(page, `study-answer-light-${info.project.name}`);
    await page.getByTestId('answer-easy').click();
    await expect.poll(async () => (await reviewLogs(request, cid)).length).toBe(1);
    const card = await getCard(request, cid);
    // Easy on a new card graduates it: review queue, interval = the engine's easy state.
    expect(card.queue).toBe(2);
    expect(card.interval).toBe(q.cards[0].states!.easy!.normal!.review!.scheduledDays);
    if (i === 0) {
      await expect.poll(() => shownCardId(page)).not.toBe(cid);
      await waitRendered(page, 'question');
    }
  }
  await expect(page.getByTestId('congrats')).toBeVisible();
  await expect(page.getByTestId('official-frame')).toBeVisible();
  await shot(page, `study-congrats-light-${info.project.name}`);
  await page.getByTestId('back-to-decks').click();
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
});

test('2-button mode: 모름 / 암기 완료 answer Again / Good with the engine states', async ({ page, request }, info) => {
  await setPrefs(request, { theme: 'light', twoButtons: true });
  const { deckId } = await smallDeck(request, 2);
  await openStudy(page, deckId);
  const cid = await shownCardId(page);
  const q = await queueFor(request, deckId);
  const labels = (await call(request, 'describeNextStates', q.cards[0].states!)).vals;
  await showAnswer(page);
  await expect(page.locator('.answer-btn')).toHaveCount(2);
  await expect(page.getByTestId('answer-again')).toContainText('모름');
  await expect(page.getByTestId('answer-good')).toContainText('암기 완료');
  await expect(page.getByTestId('answer-good')).toHaveAttribute('data-interval', labels[2]);
  await shot(page, `study-answer-2btn-light-${info.project.name}`);
  await page.getByTestId('answer-good').click();
  await expect.poll(async () => (await reviewLogs(request, cid)).map((r) => r.buttonChosen)).toEqual([3]);
  const card = await getCard(request, cid);
  const good = q.cards[0].states!.good!.normal!;
  // Good on a new card: the engine's learning (or review) state.
  if (good.learning) expect(card.queue).toBe(1);
  else expect(card.queue).toBe(2);
  // The other card is shown next; 모름 (Again) on it.
  await waitRendered(page, 'question');
  const cid2 = await shownCardId(page);
  expect(cid2).not.toBe(cid);
  await showAnswer(page);
  await page.getByTestId('answer-again').click();
  await expect.poll(async () => (await reviewLogs(request, cid2)).map((r) => r.buttonChosen)).toEqual([1]);
  await setPrefs(request, { twoButtons: false });
});

test('undo restores the answered card and its state', async ({ page, request }) => {
  await setPrefs(request, { twoButtons: false });
  const { deckId } = await smallDeck(request, 2);
  await openStudy(page, deckId);
  const cid = await shownCardId(page);
  await showAnswer(page);
  await page.getByTestId('answer-again').click();
  await expect.poll(async () => (await reviewLogs(request, cid)).length).toBe(1);
  await waitRendered(page, 'question');
  await expect(page.getByTestId('study-undo')).toBeEnabled();
  await page.getByTestId('study-undo').click();
  await expect(page.locator('.toast').filter({ hasText: /^실행 취소: / })).toBeVisible();
  await expect.poll(async () => (await reviewLogs(request, cid)).length).toBe(0);
  expect((await getCard(request, cid)).queue).toBe(0);
  await expect(page.getByTestId('study')).toHaveAttribute('data-card-id', String(cid));
  // Keyboard undo (U) after another answer.
  await showAnswer(page);
  await page.keyboard.press('3');
  await expect.poll(async () => (await reviewLogs(request, cid)).length).toBe(1);
  await waitRendered(page, 'question');
  await page.keyboard.press('u');
  await expect.poll(async () => (await reviewLogs(request, cid)).length).toBe(0);
});

test('flag, mark, bury, suspend, forget, set due date, delete reach the engine', async ({ page, request }, info) => {
  const { deckId, notes } = await smallDeck(request, 6, '동작');
  await openStudy(page, deckId);

  // Flag via the top bar menu, then Ctrl+1 toggles red / off like Anki.
  let cid = await shownCardId(page);
  await page.getByTestId('study-flag').click();
  await page.getByTestId('flag-4').click();
  await expect.poll(async () => (await getCard(request, cid)).flags & 7).toBe(4);
  await expect(page.getByTestId('flag-stripe')).toBeVisible();
  await page.keyboard.press('Control+1');
  await expect.poll(async () => (await getCard(request, cid)).flags & 7).toBe(1);
  await page.keyboard.press('Control+1');
  await expect.poll(async () => (await getCard(request, cid)).flags & 7).toBe(0);
  await expect(page.getByTestId('flag-stripe')).toBeHidden();

  // Mark (*) toggles the "marked" tag.
  const nid = notes.find((n) => n.cardIds.includes(cid))!.noteId;
  await page.keyboard.press('*');
  await expect.poll(async () => (await noteTags(request, nid)).map((t) => t.toLowerCase())).toContain('marked');
  await expect(page.getByTestId('mark-star')).toBeVisible();
  await page.getByTestId('study-flag').click();
  await page.getByTestId('flag-2').click();
  await expect(page.getByTestId('flag-stripe')).toBeVisible();
  await shot(page, `study-flag-mark-light-${info.project.name}`);
  await page.getByTestId('study-more').click();
  await page.getByTestId('act-mark').click();
  await expect.poll(async () => (await noteTags(request, nid)).length).toBe(0);

  // Bury card (menu): queue -3 (user buried), next card shown.
  await page.getByTestId('study-more').click();
  await page.getByTestId('act-bury-card').click();
  await expect.poll(async () => (await getCard(request, cid)).queue).toBe(-3);
  await expect.poll(() => shownCardId(page)).not.toBe(cid);

  // Suspend card (@).
  cid = await shownCardId(page);
  await page.keyboard.press('@');
  await expect.poll(async () => (await getCard(request, cid)).queue).toBe(-1);
  await expect.poll(() => shownCardId(page)).not.toBe(cid);

  // Set due date: 5 days -> review card due today + 5.
  cid = await shownCardId(page);
  await page.getByTestId('study-more').click();
  await page.getByTestId('act-set-due').click();
  await page.locator('#prompt-input').fill('abc');
  await page.getByTestId('prompt-dialog').getByRole('button', { name: '지정' }).click();
  await expect(page.getByTestId('prompt-dialog').locator('.field__error')).toBeVisible();
  await page.locator('#prompt-input').fill('5');
  await page.getByTestId('prompt-dialog').getByRole('button', { name: '지정' }).click();
  const today = (await call(request, 'schedTimingToday', {})).daysElapsed;
  await expect.poll(async () => (await getCard(request, cid)).queue).toBe(2);
  expect((await getCard(request, cid)).due).toBe(today + 5);
  await expect.poll(() => shownCardId(page)).not.toBe(cid);
  await waitRendered(page, 'question');

  // Bury note (=).
  cid = await shownCardId(page);
  await page.keyboard.press('=');
  await expect.poll(async () => (await getCard(request, cid)).queue).toBe(-3);
  await expect.poll(() => shownCardId(page)).not.toBe(cid);
  await waitRendered(page, 'question');

  // Delete note (confirm), then undo brings it back.
  cid = await shownCardId(page);
  const delNid = notes.find((n) => n.cardIds.includes(cid))!.noteId;
  await page.getByTestId('study-more').click();
  await page.getByTestId('act-delete').click();
  await page.getByTestId('confirm-dialog').getByRole('button', { name: '삭제' }).click();
  await expect.poll(async () => (await call(request, 'searchNotes', { search: `nid:${delNid}`, order: {} })).ids.length).toBe(0);
  await page.getByTestId('study-undo').click();
  await expect.poll(async () => (await call(request, 'searchNotes', { search: `nid:${delNid}`, order: {} })).ids.length).toBe(1);
});

test('forget resets a review card to new', async ({ page, request }) => {
  const { deckId, notes } = await smallDeck(request, 1, '잊기');
  const cid = notes[0].cardIds[0];
  await call(request, 'setDueDate', { cardIds: [cid], days: '0' });
  expect((await getCard(request, cid)).queue).toBe(2);
  await openStudy(page, deckId);
  await expect(page.getByTestId('study-counts').locator('[data-count="review"]')).toHaveClass(/is-active/);
  await page.getByTestId('study-more').click();
  await page.getByTestId('act-forget').click();
  await page.getByTestId('forget-confirm').click();
  await expect.poll(async () => (await getCard(request, cid)).queue).toBe(0);
  expect((await getCard(request, cid)).ctype).toBe(0);
  await expect(page.getByTestId('study-counts').locator('[data-count="new"]')).toHaveClass(/is-active/);
  // Undo (Ctrl+Z) makes it a review card again.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getCard(request, cid)).queue).toBe(2);
});

test('edit note and card info navigate away and come back to the same card side', async ({ page, request }) => {
  const { deckId, notes } = await smallDeck(request, 1, '편집');
  await openStudy(page, deckId);
  const cid = await shownCardId(page);
  await showAnswer(page);
  await page.keyboard.press('e');
  await expect(page).toHaveURL(new RegExp(`#/note/${notes[0].noteId}$`));
  await page.goBack();
  await waitRendered(page, 'answer');
  await expect(page.getByTestId('study')).toHaveAttribute('data-card-id', String(cid));
  await page.keyboard.press('i');
  await expect(page).toHaveURL(new RegExp(`#/card-info/${cid}$`));
  await page.goBack();
  await waitRendered(page, 'answer');
});

for (const theme of THEMES) {
  test(`looks right in ${theme}`, async ({ page, request }, info) => {
    await setPrefs(request, { theme, twoButtons: false });
    const { deckId } = await smallDeck(request, 1, '테마');
    await openStudy(page, deckId);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const bodyClass = await cardFrame(page).evaluate(() => document.body.className);
    expect(bodyClass).toMatch(/^card card1\b/);
    if (theme === 'dark') expect(bodyClass).toContain('nightMode night_mode');
    if (theme === 'eink') expect(bodyClass).toContain('eink');
    const bar = await page.getByTestId('show-answer').boundingBox();
    expect(bar!.height).toBeGreaterThanOrEqual(theme === 'eink' ? 64 : 56);
    await shot(page, `study-question-${theme}-${info.project.name}`);
    const before = await page.getByTestId('answer-bar').boundingBox();
    await showAnswer(page);
    const after = await page.getByTestId('answer-bar').boundingBox();
    // No layout jump between question and answer.
    expect(Math.round(after!.height)).toBe(Math.round(before!.height));
    expect(Math.round(after!.y)).toBe(Math.round(before!.y));
    await shot(page, `study-answer-${theme}-${info.project.name}`);
  });
}
