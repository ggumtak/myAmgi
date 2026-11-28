import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { subscribeHostEvents } from '../../host';
import { IconArrowLeft, SheetOrDialog } from '../../ui';

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

  // Pin the theme at mount so automatic OS light/dark flips never reload the iframe and drop drafts.
  const [mountedTheme] = useState(resolvedTheme);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const isDeckOptions = normalizedPath.startsWith('/deck-options');

  const src = useMemo(
    () => appendThemeQuery(normalizedPath, mountedTheme),
    [normalizedPath, mountedTheme]
  );

  // Keep latest callbacks in refs so SSE and back-handler subscriptions never churn on re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  const bumpCollectionRef = useRef(bumpCollection);
  bumpCollectionRef.current = bumpCollection;
  const isDeckOptionsRef = useRef(isDeckOptions);
  isDeckOptionsRef.current = isDeckOptions;

  const closeNow = useCallback(() => {
    setConfirmCloseOpen(false);
    if (onCloseRef.current) {
      onCloseRef.current();
    } else {
      goBackRef.current('#/decks', { force: true });
    }
  }, []);

  const requestClose = useCallback(() => {
    if (isDeckOptionsRef.current) {
      setConfirmCloseOpen(true);
      return;
    }
    closeNow();
  }, [closeNow]);

  // Intercept Android hardware back / app back when embedded or guarding deck-options.
  const hasCustomClose = Boolean(onClose);
  useEffect(() => {
    if (!hasCustomClose && !isDeckOptions) return;
    return registerBackHandler(() => {
      if (isDeckOptionsRef.current) {
        setConfirmCloseOpen(true);
        return true;
      }
      if (onCloseRef.current) {
        onCloseRef.current();
        return true;
      }
      return false;
    });
  }, [hasCustomClose, isDeckOptions, registerBackHandler]);

  // Subscribe once on mount for `anki-page` SSE close signals (e.g. deckOptionsRequireClose).
  useEffect(() => {
    return subscribeHostEvents({
      ankiPage: (ev) => {
        if (ev.close) {
          bumpCollectionRef.current();
          closeNow();
        }
      },
    });
  }, [closeNow]);

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
              onClick={requestClose}
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
          background: 'var(--surface)',
        }}
      />

      <SheetOrDialog
        open={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        title="고급 설정을 닫을까요?"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setConfirmCloseOpen(false)}
            >
              계속 보기
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={closeNow}
            >
              닫기
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          Anki 원본 고급 설정에서 저장하지 않은 변경 사항이 있다면 닫을 때 사라집니다.
          변경 내용을 적용하려면 먼저 화면 안의 저장 버튼을 눌러 주세요.
        </p>
      </SheetOrDialog>
    </div>
  );
}

export default AnkiIframeView;
