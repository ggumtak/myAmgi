import type { ReactNode } from 'react';
import './ListRow.css';

/** A tappable list row: optional leading/trailing content, title, subtitle. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  selected,
  href,
  testId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  href?: string;
  testId?: string;
}) {
  const body = (
    <>
      {leading && <span className="list-row__leading">{leading}</span>}
      <span className="list-row__text">
        <span className="list-row__title">{title}</span>
        {subtitle && <span className="list-row__subtitle">{subtitle}</span>}
      </span>
      {trailing && <span className="list-row__trailing">{trailing}</span>}
    </>
  );
  const cls = `list-row ${selected ? 'list-row--selected' : ''} ${onClick || href ? 'list-row--action' : ''}`;
  if (href)
    return (
      <a className={cls} href={href} data-testid={testId} aria-current={selected || undefined}>
        {body}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} data-testid={testId} aria-pressed={selected || undefined}>
        {body}
      </button>
    );
  return (
    <div className={cls} data-testid={testId}>
      {body}
    </div>
  );
}

export function ListSection({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="list-section">
      {title && <h2 className="list-section__title">{title}</h2>}
      <div className="list-section__body">{children}</div>
    </section>
  );
}
