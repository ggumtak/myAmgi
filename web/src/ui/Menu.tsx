// Popup menu anchored to an element or a point. Closes on outside tap, Escape, back.
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBackHandler } from '../lib/back';
import './Menu.css';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  testId?: string;
}

export type MenuAnchor = { x: number; y: number } | DOMRect;

export function Menu({
  open,
  anchor,
  items,
  onClose,
  label,
}: {
  open: boolean;
  anchor: MenuAnchor | null;
  items: MenuItem[];
  onClose: () => void;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useBackHandler(open, onClose);

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) {
      setPos(null);
      return;
    }
    const el = ref.current;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;
    let left: number;
    let top: number;
    if ('width' in anchor) {
      left = anchor.right - w;
      top = anchor.bottom + 4;
      if (top + h > vh - margin) top = anchor.top - h - 4;
    } else {
      left = anchor.x;
      top = anchor.y;
      if (top + h > vh - margin) top = anchor.y - h;
    }
    left = Math.max(margin, Math.min(left, vw - w - margin));
    top = Math.max(margin, Math.min(top, vh - h - margin));
    setPos({ left, top });
  }, [open, anchor]);

  useLayoutEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)');
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      const list = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="menu-layer" onPointerDown={(e) => e.target === e.currentTarget && onClose()} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        className="menu"
        role="menu"
        aria-label={label}
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`menu__item ${item.danger ? 'menu__item--danger' : ''}`}
            disabled={item.disabled}
            data-testid={item.testId}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
