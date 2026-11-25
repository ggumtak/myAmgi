import { describe, expect, it } from 'vitest';
import {
  FSRS5_DEFAULT_PARAMS,
  computeRetrievability,
  evaluateFsrsOptions,
  initDifficulty,
  initStability,
  nextInterval,
} from '../engine/fsrs';
import { applyReview, buildStudyQueue, computeDeckCounts } from '../engine/scheduler';
import { Card, Deck } from '../types/models';

describe('FSRS-5 Engine', () => {
  it('computes retrievability = 1 at t=0 and ~0.9 at t=S', () => {
    expect(computeRetrievability(0, 10)).toBe(1);
    const rAtS = computeRetrievability(10, 10);
    expect(rAtS).toBeCloseTo(0.9, 4);
  });

  it('initializes stability and difficulty properly for new cards', () => {
    expect(initStability(3, FSRS5_DEFAULT_PARAMS)).toBeCloseTo(FSRS5_DEFAULT_PARAMS[2], 5);
    const dGood = initDifficulty(3, FSRS5_DEFAULT_PARAMS);
    expect(dGood).toBeGreaterThanOrEqual(1);
    expect(dGood).toBeLessThanOrEqual(10);
  });

  it('computes optimal intervals matching desiredRetention', () => {
    const ivl90 = nextInterval(10, 0.9);
    const ivl95 = nextInterval(10, 0.95);
    expect(ivl90).toBe(10);
    expect(ivl95).toBeLessThan(ivl90);
  });

  it('produces monotonic intervals for Hard <= Good <= Easy on review cards', () => {
    const options = evaluateFsrsOptions(
      { stability: 10, difficulty: 5, elapsedDays: 10, reps: 3 },
      0.9
    );
    expect(options[1].intervalDays).toBe(0);
    expect(options[2].intervalDays).toBeGreaterThanOrEqual(1);
    expect(options[3].intervalDays).toBeGreaterThanOrEqual(options[2].intervalDays);
    expect(options[4].intervalDays).toBeGreaterThan(options[3].intervalDays);
    expect(options[1].stability).toBeLessThan(10);
    expect(options[3].stability).toBeGreaterThan(10);
  });

  it('aggregates nested :: deck counts and supports review + undo snapshot', () => {
    const decks: Deck[] = [
      {
        id: 1,
        name: 'Lang',
        configId: 1,
        collapsed: false,
        newPerDay: 20,
        revPerDay: 200,
        fsrsEnabled: true,
        desiredRetention: 0.9,
      },
      {
        id: 2,
        name: 'Lang::Korean',
        parent: 'Lang',
        configId: 1,
        collapsed: false,
        newPerDay: 20,
        revPerDay: 200,
        fsrsEnabled: true,
        desiredRetention: 0.9,
      },
    ];
    const cards: Card[] = [
      {
        id: 101,
        nid: 1,
        did: 2,
        ord: 0,
        queue: 0,
        type: 0,
        due: 1,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        data: {},
        mod: 0,
      },
    ];

    const counts = computeDeckCounts(decks, cards, [], Date.now());
    expect(counts.get(1)?.newCount).toBe(1);
    expect(counts.get(2)?.newCount).toBe(1);

    const queue = buildStudyQueue(decks, cards, [], 1, Date.now());
    expect(queue.map((c) => c.id)).toEqual([101]);

    const result = applyReview(cards[0], decks[1], 3, 1500);
    expect(result.previousCard.reps).toBe(0);
    expect(result.updatedCard.reps).toBe(1);
    expect(result.updatedCard.data.fsrs).toBe(true);
  });
});
