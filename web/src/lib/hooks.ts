import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * Runs `fn` when `deps` change (and on `reload()`); keeps the previous data while
 * reloading so lists do not flash.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | undefined; error: unknown; loading: boolean }>({
    data: undefined,
    error: undefined,
    loading: true,
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fnRef.current().then(
      (data) => alive && setState({ data, error: undefined, loading: false }),
      (error) => alive && setState((s) => ({ data: s.data, error, loading: false })),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mql = matchMedia(query);
      mql.addEventListener('change', cb);
      return () => mql.removeEventListener('change', cb);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}

/** Width >= 900px: navigation rail and two panes. */
export function useWide(): boolean {
  return useMediaQuery('(min-width: 900px)');
}

// A global "the collection changed" counter: screens reload when it moves.
let changeCounter = 0;
const changeListeners = new Set<() => void>();
export function notifyCollectionChanged(): void {
  changeCounter++;
  changeListeners.forEach((l) => l());
}
export function useCollectionChanges(): number {
  return useSyncExternalStore(
    (cb) => {
      changeListeners.add(cb);
      return () => changeListeners.delete(cb);
    },
    () => changeCounter,
    () => changeCounter,
  );
}

/** Calls `fn` when the window regains focus or becomes visible again. */
export function useOnFocus(fn: () => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') ref.current();
    };
    const onFocus = () => ref.current();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}
