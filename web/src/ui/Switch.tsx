import type { KeyboardEvent } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

export function Switch({
  checked,
  onChange,
  disabled = false,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
}: SwitchProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  };

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      disabled={disabled}
      className="amgi-switch"
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={handleKeyDown}
    >
      <span className="amgi-switch-track">
        <span className="amgi-switch-thumb" />
        <span className="amgi-switch-state-text" aria-hidden="true">
          {checked ? '켜짐' : '꺼짐'}
        </span>
      </span>
    </button>
  );
}
