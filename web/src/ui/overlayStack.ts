/**
 * Global stack of open modal/overlay surfaces (sheets, dialogs, menus, palettes,
 * whiteboard, inline editor popovers).
 *
 * - Android's hardware back button reaches the web UI as a host `back` event and is routed
 *   through `AppContext.handleSystemBack()`, which calls `closeTopOverlay()` first.
 * - Keyboard `Escape` is handled centrally by a single window listener here so *every*
 *   `pushOverlay()` caller — including multi-step sheets and inline popovers — closes
 *   cleanly on Escape without registering its own keydown handler.
 * - Non-blocking overlays (`blocking: false`, e.g. the study whiteboard) still close on
 *   Back/Escape via the stack, but do not block underlying Study keyboard/hardware shortcuts
 *   (`hasBlockingOverlay()`).
 */

export interface OverlayHandle {
  /** Latest close callback; updated in place so callers can pass fresh closures. */
  close: () => void;
  /**
   * Whether this overlay blocks underlying screen shortcuts & Android study keys.
   * Defaults to `true` (modal sheets, dialogs, menus). Set `false` for transparent
   * drawing layers or non-modal toolbars.
   */
  blocking?: boolean;
}

const stack: OverlayHandle[] = [];
const listeners = new Set<() => void>();
let escapeListenerAttached = false;

function notifyListeners(): void {
  for (const fn of Array.from(listeners)) {
    try {
      fn();
    } catch {
      // Ignore listener failure
    }
  }
}

function handleGlobalEscape(e: KeyboardEvent): void {
  // Ignore Escape during Korean/CJK IME composition (both standard and Android WebView 229).
  if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return;
  if (stack.length === 0) return;
  e.stopPropagation();
  closeTopOverlay();
}

function ensureEscapeListener(): void {
  if (escapeListenerAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleGlobalEscape);
  escapeListenerAttached = true;
}

/** Subscribe to stack changes (push/pop). Returns an unsubscribe function. */
export function subscribeOverlayStack(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Registers an open overlay. Returns a function that removes it again. */
export function pushOverlay(handle: OverlayHandle): () => void {
  ensureEscapeListener();
  stack.push(handle);
  notifyListeners();
  return () => {
    const idx = stack.lastIndexOf(handle);
    if (idx >= 0) {
      stack.splice(idx, 1);
      notifyListeners();
    }
  };
}

/** True when `handle` is the top-most open overlay. */
export function isTopOverlay(handle: OverlayHandle): boolean {
  return stack.length > 0 && stack[stack.length - 1] === handle;
}

/** Number of overlays currently open (blocking and non-blocking). */
export function openOverlayCount(): number {
  return stack.length;
}

/** True when at least one modal/blocking overlay is currently open. */
export function hasBlockingOverlay(): boolean {
  return stack.some((h) => h.blocking !== false);
}

/**
 * Asks the top-most overlay to close. Returns true when an overlay consumed the request
 * (even if its close callback decided to stay open, e.g. while a save is in progress).
 */
export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  try {
    top.close();
  } catch {
    // A faulty close handler must not let the back press fall through and exit the app.
  }
  return true;
}
