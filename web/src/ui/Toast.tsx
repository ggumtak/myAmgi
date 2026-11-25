// Toasts: short result messages ("덱을 만들었습니다"). Call `toast(...)` anywhere.
import { useSyncExternalStore } from 'react';
import './Toast.css';

interface ToastItem {
  id: number;
  message: string;
  kind: 'info' | 'error';
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, opts: { kind?: 'info' | 'error'; durationMs?: number } = {}): void {
  const item: ToastItem = { id: nextId++, message, kind: opts.kind ?? 'info' };
  items = [...items.slice(-2), item];
  emit();
  setTimeout(() => dismiss(item.id), opts.durationMs ?? (item.kind === 'error' ? 5000 : 3000));
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  return (
    <div className="toaster" aria-live="polite" role="status">
      {list.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
