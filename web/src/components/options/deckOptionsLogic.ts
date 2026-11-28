import type { AnkiTypes } from '../../anki/generated';

export type DeckConfigInner = AnkiTypes.deck_config.DeckConfig.Config.$Properties;

/** Inner deck-config keys the quick options screen can edit. */
export type DraftKey =
  | 'newPerDay'
  | 'reviewsPerDay'
  | 'learnSteps'
  | 'relearnSteps'
  | 'desiredRetention'
  | 'maximumReviewInterval'
  | 'newCardGatherPriority'
  | 'newCardSortOrder'
  | 'newMix'
  | 'reviewOrder'
  | 'leechThreshold'
  | 'leechAction'
  | 'buryNew'
  | 'buryReviews'
  | 'buryInterdayLearning'
  | 'disableAutoplay'
  | 'skipQuestionWhenReplayingAnswer'
  | 'showTimer'
  | 'stopTimerOnAnswer'
  | 'capAnswerTimeToSecs';

/**
 * `UpdateDeckConfigsRequest` assigns the target deck (and, in APPLY_TO_CHILDREN
 * mode, its children) to the LAST config in `configs`. Returns a copy of the list
 * with the selected config moved to the end; the relative order of the others is kept.
 */
export function orderConfigsForSave<T>(configs: readonly T[], isSelected: (c: T) => boolean): T[] {
  const idx = configs.findIndex(isSelected);
  if (idx < 0) return [...configs];
  return [...configs.slice(0, idx), ...configs.slice(idx + 1), configs[idx]];
}

/**
 * Writes only the draft values whose keys the user actually touched onto the
 * loaded config, so values the screen merely normalised for display (clamped,
 * rounded, defaulted) are saved back unchanged.
 */
export function applyTouchedDraft(
  inner: DeckConfigInner,
  draft: Partial<Record<DraftKey, unknown>>,
  touched: ReadonlySet<DraftKey>
): DeckConfigInner {
  const next: Record<string, unknown> = { ...inner };
  for (const key of touched) {
    if (key in draft) next[key] = draft[key];
  }
  return next as DeckConfigInner;
}
