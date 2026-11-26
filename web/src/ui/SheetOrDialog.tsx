import { useEffect, useId, type ReactNode } from 'react';
import { IconClose } from './Icons';

export interface SheetOrDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  maxWidth?: number;
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
}: SheetOrDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="amgi-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="amgi-sheet-dialog"
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
