import './Spinner.css';

/** Spinner; in e-ink it is a static text label (no animation). */
export function Spinner({ size = 28, inline, label = '불러오는 중' }: { size?: number; inline?: boolean; label?: string }) {
  return (
    <span className={`spinner ${inline ? 'spinner--inline' : ''}`} role="status" aria-label={label}>
      <svg className="spinner__ring" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" />
      </svg>
      <span className="spinner__text">{label}</span>
    </span>
  );
}

export function LoadingState({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div className="loading-state">
      <Spinner label={label} />
    </div>
  );
}
