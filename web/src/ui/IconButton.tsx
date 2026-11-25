import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name (Korean); also used as tooltip. */
  label: string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, ...rest },
  ref,
) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={`icon-btn ${className ?? ''}`} {...rest}>
      {children}
    </button>
  );
});
