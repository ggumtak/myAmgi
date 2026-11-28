import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './Icons';
import { pushOverlay, type OverlayHandle } from './overlayStack';

export interface SheetOrDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  maxWidth?: number;
  /**
   * `full` keeps the sheet at (almost) full height on phones so a search input at the top
   * is never covered by the soft keyboard. Wide screens show it as a top-anchored dialog.
   */
  variant?: 'default' | 'full';
}

let openSheetCount = 0;

function acquireBodyScrollLock() {
  openSheetCount += 1;
  if (openSheetCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

function releaseBodyScrollLock() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount === 0) {
    document.body.style.overflow = '';
  }
}

export function SheetOrDialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  closeLabel = '닫기',
  maxWidth,
  variant = 'default',
}: SheetOrDialogProps) {
  const titleId = useId();

  // Stable handle registered in the global overlay stack while open. `close` is refreshed
  // on every render so the stack always calls the latest `onClose` closure.
  const handleRef = useRef<OverlayHandle>({ close: onClose });
  handleRef.current.close = onClose;
  const backdropPressRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const handle = handleRef.current;
    acquireBodyScrollLock();
    const popOverlay = pushOverlay(handle);

    return () => {
      popOverlay();
      releaseBodyScrollLock();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="amgi-overlay"
      role="presentation"
      onPointerDown={(e) => {
        backdropPressRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only a press that both started and ended on the backdrop closes the sheet, so
        // selecting text or dragging a slider out of the sheet doesn't dismiss it.
        if (e.target === e.currentTarget && backdropPressRef.current) onClose();
        backdropPressRef.current = false;
      }}
    >
      <div
        className={`amgi-sheet-dialog ${variant === 'full' ? 'amgi-sheet-dialog--full' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div className="amgi-sheet-handle" aria-hidden="true" />
        <header className="amgi-sheet-header">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="amgi-sheet-title">
              {title}
            </h2>
            {subtitle && <div className="amgi-sheet-subtitle">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="amgi-btn amgi-btn-ghost amgi-btn-icon"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <IconClose size={20} />
          </button>
        </header>

        <div className="amgi-sheet-body">{children}</div>

        {footer && <footer className="amgi-sheet-footer">{footer}</footer>}
      </div>
    </div>
  );
}
