import type { ReactNode } from 'react';
import { goBack } from '../lib/back';
import { IconBack } from './icons';
import { IconButton } from './IconButton';
import './AppBar.css';

/** Top app bar (56px): optional back arrow, title, actions on the right. */
export function AppBar({
  title,
  subtitle,
  back,
  onBack,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Show a back arrow (history back). */
  back?: boolean;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="app-bar">
      {(back || onBack) && (
        <IconButton label="뒤로" onClick={onBack ?? goBack} className="app-bar__back">
          <IconBack />
        </IconButton>
      )}
      <div className={`app-bar__titles ${back || onBack ? '' : 'app-bar__titles--root'}`}>
        <h1 className="app-bar__title">{title}</h1>
        {subtitle && <div className="app-bar__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="app-bar__actions">{actions}</div>}
    </header>
  );
}
