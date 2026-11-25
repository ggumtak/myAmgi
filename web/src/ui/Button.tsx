import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text' | 'danger';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'secondary', block, loading, icon, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={['btn', `btn--${variant}`, block ? 'btn--block' : '', className ?? ''].join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={18} inline /> : icon}
      {children !== undefined && <span className="btn__label">{children}</span>}
    </button>
  );
}
