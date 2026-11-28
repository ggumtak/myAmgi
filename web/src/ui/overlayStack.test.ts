import { describe, expect, it, vi } from 'vitest';
import {
  closeTopOverlay,
  hasBlockingOverlay,
  isTopOverlay,
  openOverlayCount,
  pushOverlay,
  subscribeOverlayStack,
  type OverlayHandle,
} from './overlayStack';

describe('overlayStack', () => {
  it('closes overlays LIFO and reports openOverlayCount accurately', () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const first: OverlayHandle = { close: firstClose };
    const second: OverlayHandle = { close: secondClose };

    expect(openOverlayCount()).toBe(0);
    expect(closeTopOverlay()).toBe(false);

    const popFirst = pushOverlay(first);
    expect(openOverlayCount()).toBe(1);
    expect(isTopOverlay(first)).toBe(true);

    const popSecond = pushOverlay(second);
    expect(openOverlayCount()).toBe(2);
    expect(isTopOverlay(first)).toBe(false);
    expect(isTopOverlay(second)).toBe(true);

    expect(closeTopOverlay()).toBe(true);
    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(firstClose).not.toHaveBeenCalled();

    popSecond();
    expect(openOverlayCount()).toBe(1);
    expect(isTopOverlay(first)).toBe(true);

    expect(closeTopOverlay()).toBe(true);
    expect(firstClose).toHaveBeenCalledTimes(1);

    popFirst();
    expect(openOverlayCount()).toBe(0);
    expect(closeTopOverlay()).toBe(false);
  });

  it('distinguishes blocking vs non-blocking overlays and notifies subscribers', () => {
    const onChange = vi.fn();
    const unsub = subscribeOverlayStack(onChange);

    const wb: OverlayHandle = { close: vi.fn(), blocking: false };
    const modal: OverlayHandle = { close: vi.fn() };

    const popWb = pushOverlay(wb);
    expect(openOverlayCount()).toBe(1);
    expect(hasBlockingOverlay()).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);

    const popModal = pushOverlay(modal);
    expect(openOverlayCount()).toBe(2);
    expect(hasBlockingOverlay()).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);

    popModal();
    expect(hasBlockingOverlay()).toBe(false);
    popWb();
    expect(openOverlayCount()).toBe(0);
    unsub();
  });

  it('swallows close handler errors and still reports consumed', () => {
    const handle: OverlayHandle = {
      close: () => {
        throw new Error('boom');
      },
    };
    const pop = pushOverlay(handle);
    try {
      expect(closeTopOverlay()).toBe(true);
    } finally {
      pop();
    }
    expect(openOverlayCount()).toBe(0);
  });

  it('supports updating handle.close in place and removing out-of-order', () => {
    const a: OverlayHandle = { close: vi.fn() };
    const b: OverlayHandle = { close: vi.fn() };
    const popA = pushOverlay(a);
    const popB = pushOverlay(b);

    const refreshed = vi.fn();
    b.close = refreshed;

    // Remove the bottom overlay first (e.g. parent unmounts)
    popA();
    expect(openOverlayCount()).toBe(1);
    expect(isTopOverlay(b)).toBe(true);

    expect(closeTopOverlay()).toBe(true);
    expect(refreshed).toHaveBeenCalledTimes(1);

    popB();
    // Double-pop is a no-op
    popB();
    expect(openOverlayCount()).toBe(0);
  });
});
