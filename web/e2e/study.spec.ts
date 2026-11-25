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
  await setPrefs(request, { theme: 'auto', 'study.twoButton': null });
});

async function smallDeck(request: Parameters<typeof createDeck>[0], n = 3, prefix = '학습') {
  const deckId = await createDeck(request, uniq(`e2e::${prefix}`));
  const basic = await stockNotetypeId(request, 'basic');
  const notes = [];
  for (let i = 0; i < n; i++) notes.push(await addNote(request, deckId, basic, [`질문 ${i + 1} 日本`, `정답 ${i + 1} にほん`]));
  return { deckId, notes };
}

test('4-button session: intervals from the engine, answers recorded, congrats at the end', async ({ page, request }, info) => {
  await setPrefs(request, { theme: 'light', 'study.twoButton': false });
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
  }
  await expect(page.getByTestId('congrats')).toBeVisible();
  await expect(page.getByTestId('official-frame')).toBeVisible();
  await shot(page, `study-congrats-light-${info.project.name}`);
  await page.getByTestId('back-to-decks').click();
  await expect(page.locator('.route')).toHaveAttribute('data-route', 'decks');
});
