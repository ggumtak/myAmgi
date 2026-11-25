import { useRef, useState } from 'react';

/** Touch pull-down at scrollTop 0 triggers `onRefresh`. Returns handlers + pull distance. */
export function usePullToRefresh(onRefresh: () => void, threshold = 72) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  return {
    pull,
    armed: pull >= threshold,
    handlers: {
      onTouchStart: (e: React.TouchEvent<HTMLElement>) => {
        startY.current = e.currentTarget.scrollTop <= 0 ? e.touches[0].clientY : null;
      },
      onTouchMove: (e: React.TouchEvent<HTMLElement>) => {
        if (startY.current === null) return;
        const d = e.touches[0].clientY - startY.current;
        setPull(d > 0 ? Math.min(d * 0.5, threshold * 1.4) : 0);
      },
      onTouchEnd: () => {
        if (pull >= threshold) onRefresh();
        startY.current = null;
        setPull(0);
      },
    },
  };
}
