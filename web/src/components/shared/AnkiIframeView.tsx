import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useApp, type ResolvedTheme } from '../../context/AppContext';
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

/**
 * Applies a theme to an already loaded official page, mirroring the bootstrap script the
 * host injects into SvelteKit pages (HostServer.injectSvelteHead). Anki's pages observe the
 * `night-mode` class, so this switches theme without reloading (and losing input).
 */
function applyThemeToFrame(frame: HTMLIFrameElement | null, theme: ResolvedTheme) {
  let doc: Document | null = null;
  try {
    doc = frame?.contentDocument ?? null;
  } catch {
    doc = null; // cross-origin (should not happen): leave the page as is
  }
  if (!doc?.documentElement) return;
  const root = doc.documentElement;
  root.classList.toggle('night-mode', theme === 'dark');
  root.classList.toggle('eink-mode', theme === 'eink');
  root.setAttribute('data-bs-theme', theme === 'dark' ? 'dark' : 'light');
  if (doc.body) {
    doc.body.classList.toggle('night-mode', theme === 'dark');
    doc.body.classList.toggle('eink-mode', theme === 'eink');
  }
}

export function AnkiIframeView({
  path,
  title,
  onClose,
  showTopBar = true,
  className,
}: AnkiIframeViewProps) {
  const { resolvedTheme, goBack, registerBackHandler, subscribeAnkiPage } = useApp();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;

  // The theme only seeds the first load; later theme changes are applied in place
  // (below) so that `src` stays stable and a half-filled page is not reloaded.
  const src = useMemo(() => appendThemeQuery(path, themeRef.current), [path]);

  useEffect(() => {
    applyThemeToFrame(frameRef.current, resolvedTheme);
  }, [resolvedTheme]);

  const handleFrameLoad = useCallback(() => {
    applyThemeToFrame(frameRef.current, themeRef.current);
  }, []);

  const handleClose = useMemo(
    () => () => {
      if (onClose) {
        onClose();
      } else {
        // Leave this page itself; do not let an open sheet or handler swallow it.
        goBack('#/decks', { force: true });
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

  // Listen for the `anki-page` close signal (e.g. deckOptionsRequireClose / importDialogRequireClose)
  // on the app's single event stream. AppContext already bumps the collection for it.
  useEffect(() => {
    return subscribeAnkiPage((ev) => {
      if (ev.close) {
        handleClose();
      }
    });
  }, [subscribeAnkiPage, handleClose]);

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
        ref={frameRef}
        key={src}
        src={src}
        title={title}
        onLoad={handleFrameLoad}
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
