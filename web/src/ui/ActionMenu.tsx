import type { ReactNode } from 'react';
import { SheetOrDialog } from './SheetOrDialog';

export interface ActionMenuItem {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionMenuProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: ActionMenuItem[];
}

export function ActionMenu({
  open,
  onClose,
  title,
  subtitle,
  items,
}: ActionMenuProps) {
  return (
    <SheetOrDialog open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <div className="amgi-action-list" role="menu" aria-label={title}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`amgi-action-item ${
              item.destructive ? 'amgi-action-item-danger' : ''
            }`}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.icon && (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
            )}
            <span className="amgi-action-item-text">
              <span>{item.label}</span>
              {item.description && (
                <span className="amgi-action-item-desc">{item.description}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </SheetOrDialog>
  );
}
