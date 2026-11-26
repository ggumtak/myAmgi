// Back handling shared by the Android back button (host `back` event), Escape,
// and the app bar's back arrow. Open sheets/menus register a handler that wins.
import { useEffect, useRef } from 'react';
import { host } from '../host';
import { currentLocation, navigate } from './router';

const stack: Array<() => void> = [];

/** While mounted (and `active`), back/Escape calls `onBack` instead of navigating. */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    const h = () => ref.current();
    stack.push(h);
    return () => {
      const i = stack.lastIndexOf(h);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

export const ROOT_PATH = '/decks';

/** One back step: close the top overlay, else go back, else (root) exit. */
export function goBack(): void {
  const top = stack[stack.length - 1];
  if (top) {
    top();
    return;
  }
  const loc = currentLocation();
  if (loc.path === ROOT_PATH || loc.path === '/') {
    host.platform.exit().catch(() => {});
    return;
  }
  if (window.history.length > 1) window.history.back();
  else navigate(ROOT_PATH, { replace: true });
}

/**
 * The shell's `back {id}` event (Android back button). In-app back, then `ui.backHandled {id}`
 * (the "back-ack" feature announced in `ui.ready`); on the root screen with nothing open, ask the
 * shell to exit instead (no acknowledgement: the shell closes).
 */
export function handleShellBack(id?: number): void {
  const loc = currentLocation();
  if (!hasOverlay() && (loc.path === ROOT_PATH || loc.path === '/')) {
    host.platform.exit().catch(() => {});
    return;
  }
  goBack();
  if (typeof id === 'number') host.ui.backHandled(id).catch(() => {});
}

export function hasOverlay(): boolean {
  return stack.length > 0;
}
