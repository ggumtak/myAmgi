import { useId, type ReactNode } from 'react';

export interface SectionCardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  action,
  children,
  className = '',
}: SectionCardProps) {
  return (
    <section className={`amgi-section-card ${className}`.trim()}>
      {(title || action) && (
        <header className="amgi-section-header">
          {title ? <h3 className="amgi-section-title">{title}</h3> : <span />}
          {action}
        </header>
      )}
      <div className="amgi-section-body">{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  label: string;
  description?: string;
  control?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  htmlFor?: string;
}

export function SettingRow({
  label,
  description,
  control,
  onClick,
  selected = false,
  disabled = false,
  htmlFor,
}: SettingRowProps) {
  const labelId = useId();
  const rowClasses = [
    'amgi-setting-row',
    selected ? 'amgi-setting-row-selected' : '',
    onClick ? 'amgi-setting-row-clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const textBlock = (
    <span className="amgi-setting-text">
      {htmlFor ? (
        <label id={labelId} htmlFor={htmlFor} className="amgi-setting-label">
          {label}
        </label>
      ) : (
        <span id={labelId} className="amgi-setting-label">
          {label}
        </span>
      )}
      {description && <span className="amgi-setting-desc">{description}</span>}
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={rowClasses}
        onClick={onClick}
        disabled={disabled}
      >
        {textBlock}
        {control && <span className="amgi-setting-control">{control}</span>}
      </button>
    );
  }

  return (
    <div className={rowClasses}>
      {textBlock}
      {control && <div className="amgi-setting-control">{control}</div>}
    </div>
  );
}
