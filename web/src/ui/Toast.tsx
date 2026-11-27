import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconCheck, IconClose } from './Icons';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Map<number, number>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info', action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { id, message, kind, action }]);
      const duration = action ? 5200 : 3200;
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      activeTimers.forEach((t) => window.clearTimeout(t));
      activeTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="amgi-toast-region" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`amgi-toast ${
              toast.kind === 'success'
                ? 'amgi-toast-success'
                : toast.kind === 'error'
                  ? 'amgi-toast-error'
                  : ''
            }`.trim()}
          >
            {toast.kind === 'success' && <IconCheck size={18} />}
            <span style={{ flex: 1 }}>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="amgi-toast-action compact"
                data-compact="true"
                onClick={() => {
                  const fn = toast.action?.onClick;
                  dismiss(toast.id);
                  if (fn) void fn();
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="amgi-toast-close compact"
              data-compact="true"
              onClick={() => dismiss(toast.id)}
              aria-label="알림 닫기"
            >
              <IconClose size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
