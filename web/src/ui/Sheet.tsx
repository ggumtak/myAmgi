// Dialog: bottom sheet on phones, centred dialog (max 480px) on wide screens.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler } from '../lib/back';
import { useWide } from '../lib/hooks';
import './Sheet.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons row at the bottom (right-aligned on wide, stacked full-width on phones). */
  actions?: ReactNode;
  /** Prevent closing by scrim tap (e.g. while saving). */
  busy?: boolean;
  testId?: string;
}

export function Sheet({ open, onClose, title, children, actions, busy, testId }: SheetProps) {
  const wide = useWide();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => {
    if (!busy) onClose();
  };
  useBackHandler(open, close);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first input, else the panel itself.
    const first = panel?.querySelector<HTMLElement>('input, textarea, select');
    (first ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab' && panel) {
        const items = panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className={`sheet-layer ${wide ? 'sheet-layer--dialog' : 'sheet-layer--sheet'}`}>
      <div className="sheet-scrim" onClick={close} />
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-testid={testId}
      >
        {!wide && <div className="sheet__grip" aria-hidden="true" />}
        {title && (
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
        )}
        {children && <div className="sheet__body">{children}</div>}
        {actions && <div className="sheet__actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
