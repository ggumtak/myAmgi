/** A settings row with a switch. */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  testId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <label className="toggle-row" data-testid={testId}>
      <span className="toggle-row__text">
        <span>{label}</span>
        {hint && <span className="toggle-row__hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
