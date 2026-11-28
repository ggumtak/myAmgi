import { useEffect, useId, useRef, type ReactNode } from 'react';
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
  /**
   * When false (e.g. while a destructive action is running), Escape, Android back,
   * the backdrop and the close button do not close the sheet. Back is still consumed
   * so the screen underneath does not navigate away. Default true.
   */
  dismissible?: boolean;
}

/* --------------------------------------------------------------------------
 * Module-level modal stack.
 *
 * Every open SheetOrDialog (and ActionMenu, which renders through it) pushes an
 * entry. Escape (one window listener for the whole stack) and Android back
 * (`closeTopModal`, called from AppContext.goBack) act only on the top entry.
 * ------------------------------------------------------------------------ */

interface ModalEntry {
  requestClose: () => void;
  container: () => HTMLElement | null;
}

const modalStack: ModalEntry[] = [];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

function onStackKeyDown(e: KeyboardEvent) {
  const top = modalStack[modalStack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    if (e.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    top.requestClose();
    return;
  }
  if (e.key === 'Tab') {
    const container = top.container();
    if (!container) return;
    const items = focusableIn(container);
    if (items.length === 0) {
      e.preventDefault();
      container.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;
    const inside = active ? container.contains(active) : false;
    if (e.shiftKey) {
      if (!inside || active === first || active === container) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function pushModal(entry: ModalEntry) {
  modalStack.push(entry);
  if (modalStack.length === 1) {
    // Capture phase so screen-level Escape handlers do not also fire.
    window.addEventListener('keydown', onStackKeyDown, true);
  }
}

function removeModal(entry: ModalEntry) {
  const idx = modalStack.lastIndexOf(entry);
  if (idx >= 0) modalStack.splice(idx, 1);
  if (modalStack.length === 0) {
    window.removeEventListener('keydown', onStackKeyDown, true);
  }
}

/** True while any SheetOrDialog/ActionMenu is open. */
export function hasOpenModal(): boolean {
  return modalStack.length > 0;
}

/**
 * Asks the top-most open sheet/dialog to close (respecting `dismissible`).
 * Returns true if a modal was open, i.e. the back press was consumed.
 */
export function closeTopModal(): boolean {
  const top = modalStack[modalStack.length - 1];
  if (!top) return false;
  top.requestClose();
  return true;
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
  dismissible = true,
}: SheetOrDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  // Capture the opener during the render that opens the dialog: by the time effects
  // run, `autoFocus` children have already moved focus into the dialog.
  const wasOpenRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  if (open && !wasOpenRef.current && typeof document !== 'undefined') {
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
  }
  wasOpenRef.current = open;

  // Stable across renders (reads refs), so the stack entry never goes stale.
  const requestCloseRef = useRef(() => {
    if (!dismissibleRef.current) return;
    onCloseRef.current();
  });
  const requestClose = requestCloseRef.current;

  useEffect(() => {
    if (!open) return;

    acquireBodyScrollLock();
    const entry: ModalEntry = {
      requestClose,
      container: () => dialogRef.current,
    };
    pushModal(entry);

    const opener = openerRef.current;
    const container = dialogRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }

    return () => {
      releaseBodyScrollLock();
      removeModal(entry);
      // Restore focus to the opener unless focus already moved somewhere else (e.g. into
      // another dialog that opened in the same commit). Once this dialog's DOM is gone,
      // a focus that was inside it falls back to <body>.
      const active = document.activeElement;
      const focusIsElsewhere = Boolean(active && active !== document.body);
      if (opener && opener.isConnected && !focusIsElsewhere) {
        try {
          opener.focus({ preventScroll: true });
        } catch {
          // Ignore focus errors on detached/unfocusable elements
        }
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="amgi-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className="amgi-sheet-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
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
            onClick={requestClose}
            disabled={!dismissible}
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
