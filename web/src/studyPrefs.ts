/**
 * Shared study preference resolution so Settings and the reviewer agree on defaults.
 */

/**
 * Whether the reviewer shows two answer buttons (Again / Good) instead of four.
 *
 * Order: `study.twoButton` (current key) → legacy `study.twoButtonMode` → `true`.
 * Two-button mode is the product default on every flavor, so `info` (e.g. `eink`)
 * does not change the default; it is accepted for future per-device rules.
 */
export function resolveTwoButtonMode(
  prefs: Record<string, unknown>,
  _info?: { eink?: boolean } | null
): boolean {
  const current = prefs['study.twoButton'];
  if (typeof current === 'boolean') return current;
  const legacy = prefs['study.twoButtonMode'];
  if (typeof legacy === 'boolean') return legacy;
  return true;
}
