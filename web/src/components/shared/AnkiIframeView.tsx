import { useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { subscribeHostEvents } from '../../host';
import { IconArrowLeft } from '../../ui';

export interface AnkiIframeViewProps {
  /** Official SvelteKit route path, e.g. `/deck-options/123` or `/graphs`. */
  path: string;
  /** Top bar title shown in Korean. */
  title: string;
  /** Called when the user presses Back or the embedded page requests closing (`anki-page` `close: true`). */
  onClose?: () => void;
  /** Whether to render the sticky top bar with back button & title. Defaults to `true`. */
  showTopBar?: boolean;
  className?: string;
}

function appendThemeQuery(rawPath: string, theme: string): string {
  const normalized = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const hashIdx = normalized.indexOf('#');
  const base = hashIdx >= 0 ? normalized.slice(0, hashIdx) : normalized;
  const hash = hashIdx >= 0 ? normalized.slice(hashIdx) : '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}theme=${encodeURIComponent(theme)}${hash}`;
}

export function AnkiIframeView({
  path,
  title,
  onClose,
  showTopBar = true,
  className,
}: AnkiIframeViewProps) {
  const { resolvedTheme, goBack, bumpCollection, registerBackHandler } = useApp();

  const src = useMemo(() => appendThemeQuery(path, resolvedTheme), [path, resolvedTheme]);

  const handleClose = useMemo(
    () => () => {
      if (onClose) {
        onClose();
      } else {
        goBack('#/decks');
      }
    },
    [onClose, goBack]
  );

  // Intercept Android hardware back / app back when this view is active
  useEffect(() => {
    if (!onClose) return;
    return registerBackHandler(() => {
      onClose();
      return true;
    });
  }, [onClose, registerBackHandler]);

  // Listen for `anki-page` SSE close signal (e.g. deckOptionsRequireClose / importDialogRequireClose)
  useEffect(() => {
    return subscribeHostEvents({
      ankiPage: (ev) => {
        if (ev.close) {
          bumpCollection();
          handleClose();
        }
      },
    });
  }, [bumpCollection, handleClose]);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: showTopBar ? '100dvh' : 480,
        background: 'var(--bg)',
      }}
    >
      {showTopBar && (
        <header className="amgi-topbar">
          <div className="amgi-topbar-left">
            <button
              type="button"
              className="amgi-btn amgi-btn-ghost amgi-btn-icon"
              onClick={handleClose}
              aria-label="뒤로 가기"
            >
              <IconArrowLeft size={20} />
            </button>
            <h1 className="amgi-topbar-title">{title}</h1>
          </div>
        </header>
      )}
      <iframe
        key={src}
        src={src}
        title={title}
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          border: 'none',
          display: 'block',
          background: resolvedTheme === 'dark' ? '#161B24' : '#FFFFFF',
        }}
      />
    </div>
  );
}

export default AnkiIframeView;
