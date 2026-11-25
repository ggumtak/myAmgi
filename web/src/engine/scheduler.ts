import { Card, Deck, Ease, Revlog } from '../types/models';
import { evaluateFsrsOptions, formatIntervalLabel } from './fsrs';

export interface DeckCounts {
  deckId: number;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  totalDue: number;
}

export interface SchedulingPreview {
  ease: Ease;
  label: string;
  nextCard: Card;
  revlog: Omit<Revlog, 'id'>;
}

export interface ReviewResult {
  previousCard: Card;
  updatedCard: Card;
  revlog: Revlog;
}

const MS_PER_DAY = 86_400_000;
const LEARNING_STEPS_MINUTES = [1, 10];
const RELEARNING_STEPS_MINUTES = [10];

export function getTodayDayNumber(nowMs = Date.now(), collectionCreatedAt = 0): number {
  const baseDay = Math.floor(collectionCreatedAt / MS_PER_DAY);
  const currentDay = Math.floor(nowMs / MS_PER_DAY);
  // If collectionCreatedAt is unset or 0, use epoch days directly (compatible with Anki day index when normalized)
  if (!collectionCreatedAt || collectionCreatedAt <= 0) {
    return currentDay;
  }
  return Math.max(0, currentDay - baseDay);
}

/**
 * Normalize card due day comparison:
 * Anki stores review `due` as days since collection creation (usually < 50000),
 * whereas epoch days are ~20000+. We support both cleanly.
 */
export function isReviewCardDue(card: Card, nowMs = Date.now(), collectionCreatedAt = 0): boolean {
  if (card.queue !== 2) return false;
  const epochDay = Math.floor(nowMs / MS_PER_DAY);
  if (card.due >= 15000 && card.due < 100000 && collectionCreatedAt <= 0) {
    return card.due <= epochDay;
  }
  // If collectionCreatedAt is set, compare against relative day when due is small (< 15000)
  if (card.due < 15000) {
    const relDay = getTodayDayNumber(nowMs, collectionCreatedAt);
    return card.due <= relDay;
  }
  return card.due <= epochDay;
}

export function isLearningCardDue(card: Card, nowMs = Date.now()): boolean {
  if (card.queue === 1) {
    // Anki stores queue=1 due in seconds (10 digits) or ms (13 digits)
    const dueMs = card.due < 1e11 ? card.due * 1000 : card.due;
    return dueMs <= nowMs + 60_000; // 1-min lookahead like Anki
  }
  if (card.queue === 3) {
    const epochDay = Math.floor(nowMs / MS_PER_DAY);
    return card.due <= epochDay;
  }
  return false;
}

export function isDeckDescendantOrSelf(deckName: string, targetDeckName: string): boolean {
  return deckName === targetDeckName || deckName.startsWith(`${targetDeckName}::`);
}

export function getMatchingDeckIds(decks: Deck[], targetDeckId: number): Set<number> {
  const target = decks.find((d) => d.id === targetDeckId);
  if (!target) return new Set([targetDeckId]);
  const ids = new Set<number>();
  for (const d of decks) {
    if (isDeckDescendantOrSelf(d.name, target.name)) {
      ids.add(d.id);
    }
  }
  return ids;
}

export function getTodayReviewStats(
  revlogs: Revlog[],
  cardsById: Map<number, Card>,
  nowMs = Date.now()
): { newReviewedByDeck: Map<number, number>; revReviewedByDeck: Map<number, number> } {
  const startOfDay = new Date(nowMs);
  startOfDay.setHours(0, 0, 0, 0);
  const startMs = startOfDay.getTime();

  const newReviewedByDeck = new Map<number, number>();
  const revReviewedByDeck = new Map<number, number>();

  for (const r of revlogs) {
    if (r.id < startMs) continue;
    const card = cardsById.get(r.cid);
    if (!card) continue;
    if (r.type === 0) {
      newReviewedByDeck.set(card.did, (newReviewedByDeck.get(card.did) ?? 0) + 1);
    } else if (r.type === 1) {
      revReviewedByDeck.set(card.did, (revReviewedByDeck.get(card.did) ?? 0) + 1);
    }
  }

  return { newReviewedByDeck, revReviewedByDeck };
}

export function computeDeckCounts(
  decks: Deck[],
  cards: Card[],
  revlogs: Revlog[],
  nowMs = Date.now(),
  collectionCreatedAt = 0
): Map<number, DeckCounts> {
  const cardsById = new Map<number, Card>();
  for (const c of cards) cardsById.set(c.id, c);

  const { newReviewedByDeck, revReviewedByDeck } = getTodayReviewStats(revlogs, cardsById, nowMs);
  const result = new Map<number, DeckCounts>();

  for (const deck of decks) {
    const matchingIds = getMatchingDeckIds(decks, deck.id);
    let rawNew = 0;
    let rawLearn = 0;
    let rawRev = 0;
    let usedNew = 0;
    let usedRev = 0;

    for (const did of matchingIds) {
      usedNew += newReviewedByDeck.get(did) ?? 0;
      usedRev += revReviewedByDeck.get(did) ?? 0;
    }

    for (const c of cards) {
      if (!matchingIds.has(c.did) || c.queue === -1) continue;
      if (c.queue === 0) rawNew++;
      else if (c.queue === 1 || c.queue === 3) {
        if (isLearningCardDue(c, nowMs)) rawLearn++;
      } else if (c.queue === 2) {
        if (isReviewCardDue(c, nowMs, collectionCreatedAt)) rawRev++;
      }
    }

    const remNew = Math.max(0, deck.newPerDay - usedNew);
    const remRev = Math.max(0, deck.revPerDay - usedRev);

    const newCount = Math.min(rawNew, remNew);
    const reviewCount = Math.min(rawRev, remRev);
    const learnCount = rawLearn;

    result.set(deck.id, {
      deckId: deck.id,
      newCount,
      learnCount,
      reviewCount,
      totalDue: newCount + learnCount + reviewCount,
    });
  }

  return result;
}

export function buildStudyQueue(
  decks: Deck[],
  cards: Card[],
  revlogs: Revlog[],
  targetDeckId: number,
  nowMs = Date.now(),
  collectionCreatedAt = 0
): Card[] {
  const targetDeck = decks.find((d) => d.id === targetDeckId);
  if (!targetDeck) return [];

  const matchingIds = getMatchingDeckIds(decks, targetDeckId);
  const cardsById = new Map<number, Card>();
  for (const c of cards) cardsById.set(c.id, c);

  const { newReviewedByDeck, revReviewedByDeck } = getTodayReviewStats(revlogs, cardsById, nowMs);
  let usedNew = 0;
  let usedRev = 0;
  for (const did of matchingIds) {
    usedNew += newReviewedByDeck.get(did) ?? 0;
    usedRev += revReviewedByDeck.get(did) ?? 0;
  }

  const maxNew = Math.max(0, targetDeck.newPerDay - usedNew);
  const maxRev = Math.max(0, targetDeck.revPerDay - usedRev);

  const learnDue: Card[] = [];
  const revDue: Card[] = [];
  const newCards: Card[] = [];

  for (const c of cards) {
    if (!matchingIds.has(c.did) || c.queue === -1) continue;
    if (c.queue === 1 || c.queue === 3) {
      if (isLearningCardDue(c, nowMs)) learnDue.push(c);
    } else if (c.queue === 2) {
      if (isReviewCardDue(c, nowMs, collectionCreatedAt)) revDue.push(c);
    } else if (c.queue === 0) {
      newCards.push(c);
    }
  }

  learnDue.sort((a, b) => a.due - b.due);
  revDue.sort((a, b) => a.due - b.due);
  newCards.sort((a, b) => a.due - b.due || a.id - b.id);

  return [
    ...learnDue,
    ...revDue.slice(0, maxRev),
    ...newCards.slice(0, maxNew),
  ];
}

function scheduleSm2(card: Card, ease: Ease, nowMs: number): SchedulingPreview {
  const epochDay = Math.floor(nowMs / MS_PER_DAY);
  const next: Card = {
    ...card,
    data: { ...card.data },
    reps: card.reps + 1,
    mod: Math.floor(nowMs / 1000),
  };

  let factor = card.factor > 0 ? card.factor : 2500;
  const prevIvl = card.ivl;
  let nextIvl = 1;
  let label = '1일';
  const revType = card.type === 0 ? 0 : card.type === 2 ? 1 : 2;

  if (card.queue === 0 || card.queue === 1 || card.queue === 3) {
    // New / Learning
    if (ease === 1) {
      next.queue = 1;
      next.type = card.type === 2 || card.type === 3 ? 3 : 1;
      next.due = Math.floor(nowMs / 1000) + LEARNING_STEPS_MINUTES[0] * 60;
      next.ivl = 0;
      next.lapses = card.type === 2 ? card.lapses + 1 : card.lapses;
      label = formatIntervalLabel(0, LEARNING_STEPS_MINUTES[0]);
    } else if (ease === 2) {
      next.queue = 1;
      next.type = card.type === 2 || card.type === 3 ? 3 : 1;
      next.due = Math.floor(nowMs / 1000) + 6 * 60;
      next.ivl = 0;
      label = formatIntervalLabel(0, 6);
    } else if (ease === 3) {
      if (card.queue === 0) {
        next.queue = 1;
        next.type = 1;
        next.due = Math.floor(nowMs / 1000) + LEARNING_STEPS_MINUTES[1] * 60;
        next.ivl = 0;
        label = formatIntervalLabel(0, LEARNING_STEPS_MINUTES[1]);
      } else {
        nextIvl = Math.max(1, card.type === 3 ? Math.max(1, Math.round(card.ivl * 0.5)) : 1);
        next.queue = 2;
        next.type = 2;
        next.ivl = nextIvl;
        next.due = epochDay + nextIvl;
        label = formatIntervalLabel(nextIvl);
      }
    } else {
      nextIvl = 4;
      next.queue = 2;
      next.type = 2;
      next.ivl = nextIvl;
      next.due = epochDay + nextIvl;
      label = formatIntervalLabel(nextIvl);
    }
  } else {
    // Review card
    if (ease === 1) {
      factor = Math.max(1300, factor - 200);
      next.queue = 1;
      next.type = 3;
      next.lapses = card.lapses + 1;
      next.due = Math.floor(nowMs / 1000) + RELEARNING_STEPS_MINUTES[0] * 60;
      next.ivl = Math.max(1, Math.round(prevIvl * 0.2));
      label = formatIntervalLabel(0, RELEARNING_STEPS_MINUTES[0]);
    } else if (ease === 2) {
      factor = Math.max(1300, factor - 150);
      nextIvl = Math.max(prevIvl + 1, Math.round(prevIvl * 1.2));
      next.queue = 2;
      next.type = 2;
      next.ivl = nextIvl;
      next.due = epochDay + nextIvl;
      label = formatIntervalLabel(nextIvl);
    } else if (ease === 3) {
      nextIvl = Math.max(prevIvl + 1, Math.round(prevIvl * (factor / 1000)));
      next.queue = 2;
      next.type = 2;
      next.ivl = nextIvl;
      next.due = epochDay + nextIvl;
      label = formatIntervalLabel(nextIvl);
    } else {
      factor = factor + 150;
      nextIvl = Math.max(prevIvl + 2, Math.round(prevIvl * (factor / 1000) * 1.3));
      next.queue = 2;
      next.type = 2;
      next.ivl = nextIvl;
      next.due = epochDay + nextIvl;
      label = formatIntervalLabel(nextIvl);
    }
  }

  next.factor = factor;

  return {
    ease,
    label,
    nextCard: next,
    revlog: {
      cid: card.id,
      ease,
      ivl: next.queue === 1 ? -60 : next.ivl,
      lastIvl: prevIvl,
      factor: next.factor,
      time: 0,
      type: revType,
    },
  };
}

export function previewCardScheduling(
  card: Card,
  deck: Deck | undefined,
  nowMs = Date.now()
): Record<Ease, SchedulingPreview> {
  const fsrsEnabled = deck?.fsrsEnabled ?? true;
  if (!fsrsEnabled) {
    return {
      1: scheduleSm2(card, 1, nowMs),
      2: scheduleSm2(card, 2, nowMs),
      3: scheduleSm2(card, 3, nowMs),
      4: scheduleSm2(card, 4, nowMs),
    };
  }

  const desiredRetention = card.data.dr ?? deck?.desiredRetention ?? 0.9;
  const epochDay = Math.floor(nowMs / MS_PER_DAY);
  const elapsedDays =
    card.queue === 2 && card.ivl > 0
      ? Math.max(1, card.ivl)
      : card.queue === 1 || card.queue === 3
        ? 0
        : 0;

  const fsrsOptions = evaluateFsrsOptions(
    {
      stability: card.data.s,
      difficulty: card.data.d,
      elapsedDays,
      reps: card.reps,
    },
    desiredRetention,
    deck?.fsrsParams
  );

  const previews = {} as Record<Ease, SchedulingPreview>;

  for (const ease of [1, 2, 3, 4] as Ease[]) {
    const out = fsrsOptions[ease];
    const next: Card = {
      ...card,
      data: {
        ...card.data,
        s: Number(out.stability.toFixed(4)),
        d: Number(out.difficulty.toFixed(4)),
        dr: desiredRetention,
        fsrs: true,
      },
      reps: card.reps + 1,
      mod: Math.floor(nowMs / 1000),
    };

    const revType = card.type === 0 ? 0 : card.type === 2 ? 1 : 2;
    let label = '';

    if (ease === 1) {
      next.queue = 1;
      next.type = card.type === 2 || card.type === 3 ? 3 : 1;
      next.lapses = card.type === 2 ? card.lapses + 1 : card.lapses;
      next.due = Math.floor(nowMs / 1000) + LEARNING_STEPS_MINUTES[0] * 60;
      next.ivl = 0;
      label = formatIntervalLabel(0, LEARNING_STEPS_MINUTES[0]);
    } else if (ease === 2 && (card.queue === 0 || card.queue === 1)) {
      next.queue = 1;
      next.type = card.type === 2 || card.type === 3 ? 3 : 1;
      next.due = Math.floor(nowMs / 1000) + 6 * 60;
      next.ivl = 0;
      label = formatIntervalLabel(0, 6);
    } else if (ease === 3 && card.queue === 0 && card.reps === 0) {
      // First time seeing a brand new card -> short learning step or graduate
      // In FSRS-5 Anki, Good on new card enters 10m step, or if graduated uses out.intervalDays.
      // We keep short 10m step for brand new card so user experiences immediate reinforcement,
      // and on second Good it graduates to out.intervalDays!
      next.queue = 1;
      next.type = 1;
      next.due = Math.floor(nowMs / 1000) + LEARNING_STEPS_MINUTES[1] * 60;
      next.ivl = 0;
      label = formatIntervalLabel(0, LEARNING_STEPS_MINUTES[1]);
    } else {
      const ivl = Math.max(1, out.intervalDays);
      next.queue = 2;
      next.type = 2;
      next.ivl = ivl;
      next.due = epochDay + ivl;
      label = formatIntervalLabel(ivl);
    }

    previews[ease] = {
      ease,
      label,
      nextCard: next,
      revlog: {
        cid: card.id,
        ease,
        ivl: next.queue === 1 ? -60 : next.ivl,
        lastIvl: card.ivl,
        factor: Math.round(out.difficulty * 1000),
        time: 0,
        type: revType,
      },
    };
  }

  return previews;
}

export function applyReview(
  card: Card,
  deck: Deck | undefined,
  ease: Ease,
  elapsedMs: number,
  nowMs = Date.now()
): ReviewResult {
  const previews = previewCardScheduling(card, deck, nowMs);
  const chosen = previews[ease];
  const revlog: Revlog = {
    ...chosen.revlog,
    id: nowMs,
    time: Math.min(60000, Math.max(100, Math.round(elapsedMs))),
  };
  return {
    previousCard: { ...card, data: { ...card.data } },
    updatedCard: chosen.nextCard,
    revlog,
  };
}
