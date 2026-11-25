import { useRef } from 'react';

/**
 * Long-press on touch/pen (and right click via onContextMenu). Returns handlers
 * to spread on the element and `consumeClick()` to swallow the click that
 * follows a long-press.
 */
export function useLongPress(onLongPress: (pt: { x: number; y: number }) => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') return;
        fired.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          if (start.current) onLongPress(start.current);
        }, ms);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!start.current) return;
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        clear();
        if (fired.current) return; // the touch timer already opened it
        const pt = (e.nativeEvent as PointerEvent).pointerType;
        // A touch long-press is followed by a click we must swallow; a right click is not.
        fired.current = pt === 'touch' || pt === 'pen';
        onLongPress({ x: e.clientX, y: e.clientY });
      },
    },
    consumeClick(): boolean {
      if (fired.current) {
        fired.current = false;
        return true;
      }
      return false;
    },
  };
}
