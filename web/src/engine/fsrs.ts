import { Ease } from '../types/models';

/**
 * FSRS-5 Default 19 parameters (w0 .. w18)
 */
export const FSRS5_DEFAULT_PARAMS: readonly number[] = [
  0.40255, // w0: initial stability for Again
  1.18385, // w1: initial stability for Hard
  3.173,   // w2: initial stability for Good
  15.69105,// w3: initial stability for Easy
  7.1949,  // w4: initial difficulty base
  0.5345,  // w5: initial difficulty slope
  1.4604,  // w6: difficulty delta weight
  0.0046,  // w7: mean reversion weight
  1.54575, // w8: recall stability exp base
  0.1192,  // w9: recall stability S^-w9
  1.01925, // w10: recall stability retrievability factor
  1.9395,  // w11: forget stability base
  0.11,    // w12: forget stability D^-w12
  0.29605, // w13: forget stability (S+1)^w13
  2.2698,  // w14: forget stability retrievability factor
  0.2315,  // w15: hard penalty
  2.9898,  // w16: easy bonus
  0.51655, // w17: short-term stability base
  0.6621,  // w18: short-term stability offset
];

export const FSRS_DECAY = -0.5;
export const FSRS_FACTOR = 19 / 81; // (0.9^(1/-0.5) - 1) = 19/81

export interface FsrsState {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  lastReviewDays?: number;
}

export interface FsrsNextOutcome {
  ease: Ease;
  stability: number;
  difficulty: number;
  intervalDays: number;
  retrievability: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function getParams(custom?: number[]): number[] {
  if (custom && custom.length >= 19) return custom.slice(0, 19);
  if (custom && custom.length === 17) {
    return [...custom, FSRS5_DEFAULT_PARAMS[17], FSRS5_DEFAULT_PARAMS[18]];
  }
  return [...FSRS5_DEFAULT_PARAMS];
}

/**
 * Compute FSRS-5 power-law forgetting curve retrievability R(t, S).
 */
export function computeRetrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  if (elapsedDays <= 0) return 1;
  return Math.pow(1 + FSRS_FACTOR * (elapsedDays / stability), FSRS_DECAY);
}

/**
 * Initial stability S0(G) for rating G in {1,2,3,4}.
 */
export function initStability(ease: Ease, w: readonly number[]): number {
  return Math.max(0.01, w[ease - 1]);
}

/**
 * Initial difficulty D0(G) = w4 - exp(w5 * (G - 1)) + 1, clamped to [1, 10].
 */
export function initDifficulty(ease: Ease, w: readonly number[]): number {
  const d0 = w[4] - Math.exp(w[5] * (ease - 1)) + 1;
  return clamp(d0, 1, 10);
}

/**
 * Linear damping + mean reversion for next difficulty D'(D, G).
 */
export function nextDifficulty(d: number, ease: Ease, w: readonly number[]): number {
  const deltaD = -w[6] * (ease - 3);
  const dPrime = d + deltaD * ((10 - d) / 9);
  const d0Easy = initDifficulty(4, w);
  const reverted = w[7] * d0Easy + (1 - w[7]) * dPrime;
  return clamp(reverted, 1, 10);
}

/**
 * Short-term stability update for same-day / learning transitions (FSRS-5 w17, w18).
 */
export function shortTermStability(s: number, ease: Ease, w: readonly number[]): number {
  const sNew = s * Math.exp(w[17] * (ease - 3 + w[18]));
  return Math.max(0.01, sNew);
}

/**
 * Recall stability S'_r(D, S, R, G) for Hard/Good/Easy.
 */
export function nextRecallStability(
  d: number,
  s: number,
  r: number,
  ease: Ease,
  w: readonly number[]
): number {
  const hardPenalty = ease === 2 ? w[15] : 1;
  const easyBonus = ease === 4 ? w[16] : 1;
  const mult =
    1 +
    Math.exp(w[8]) *
      (11 - d) *
      Math.pow(Math.max(0.01, s), -w[9]) *
      (Math.exp((1 - r) * w[10]) - 1) *
      hardPenalty *
      easyBonus;
  return Math.max(0.01, s * mult);
}

/**
 * Forget stability S'_f(D, S, R) for Again (lapse).
 */
export function nextForgetStability(
  d: number,
  s: number,
  r: number,
  w: readonly number[]
): number {
  const sForget =
    w[11] *
    Math.pow(d, -w[12]) *
    (Math.pow(Math.max(0.01, s) + 1, w[13]) - 1) *
    Math.exp((1 - r) * w[14]);
  return Math.max(0.01, Math.min(s, sForget));
}

/**
 * Compute optimal interval (days) given stability S and desiredRetention (0.7..0.99).
 */
export function nextInterval(
  stability: number,
  desiredRetention = 0.9,
  maxInterval = 36500
): number {
  const dr = clamp(desiredRetention, 0.7, 0.99);
  const raw = (stability / FSRS_FACTOR) * (Math.pow(dr, 1 / FSRS_DECAY) - 1);
  return clamp(Math.round(raw), 1, maxInterval);
}

/**
 * Evaluate all 4 ratings (Again=1, Hard=2, Good=3, Easy=4) for a card using FSRS-5.
 */
export function evaluateFsrsOptions(
  current: { stability?: number; difficulty?: number; elapsedDays?: number; reps?: number },
  desiredRetention = 0.9,
  customParams?: number[],
  maxInterval = 36500
): Record<Ease, FsrsNextOutcome> {
  const w = getParams(customParams);
  const isNew =
    current.stability === undefined ||
    current.stability <= 0 ||
    current.difficulty === undefined ||
    current.difficulty <= 0 ||
    (current.reps ?? 0) === 0;

  const elapsed = Math.max(0, current.elapsedDays ?? 0);
  const outcomes = {} as Record<Ease, FsrsNextOutcome>;

  for (const ease of [1, 2, 3, 4] as Ease[]) {
    if (isNew) {
      const s = initStability(ease, w);
      const d = initDifficulty(ease, w);
      const ivl = ease === 1 ? 0 : nextInterval(s, desiredRetention, maxInterval);
      outcomes[ease] = {
        ease,
        stability: s,
        difficulty: d,
        intervalDays: ivl,
        retrievability: 1,
      };
    } else {
      const prevS = current.stability!;
      const prevD = current.difficulty!;
      const r = computeRetrievability(elapsed, prevS);
      const newD = nextDifficulty(prevD, ease, w);
      let newS: number;
      if (elapsed === 0) {
        newS = shortTermStability(prevS, ease, w);
      } else if (ease === 1) {
        newS = nextForgetStability(prevD, prevS, r, w);
      } else {
        newS = nextRecallStability(prevD, prevS, r, ease, w);
      }
      const ivl = ease === 1 ? 0 : nextInterval(newS, desiredRetention, maxInterval);
      outcomes[ease] = {
        ease,
        stability: newS,
        difficulty: newD,
        intervalDays: ivl,
        retrievability: r,
      };
    }
  }

  // Ensure monotonic intervals for Hard <= Good <= Easy on mature/graduated cards
  if (outcomes[2].intervalDays > outcomes[3].intervalDays) {
    outcomes[3].intervalDays = outcomes[2].intervalDays;
  }
  if (outcomes[3].intervalDays >= outcomes[4].intervalDays && outcomes[4].intervalDays > 0) {
    outcomes[4].intervalDays = Math.min(maxInterval, outcomes[3].intervalDays + 1);
  }

  return outcomes;
}

export function formatIntervalLabel(days: number, learningMinutes?: number): string {
  if (learningMinutes !== undefined && days === 0) {
    if (learningMinutes < 60) return `${Math.max(1, Math.round(learningMinutes))}분`;
    const hours = Math.round(learningMinutes / 60);
    return `${hours}시간`;
  }
  if (days <= 0) return '1분';
  if (days === 1) return '1일';
  if (days < 30) return `${days}일`;
  if (days < 365) {
    const months = Math.round((days / 30) * 10) / 10;
    return `${months}개월`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return `${years}년`;
}
