// Root: boots from the host (info + UI prefs), applies the theme, wires the
// Android back button, and renders the routed screen inside the shell.
import { useEffect, useState } from 'react';
import { host, hostInfoStore, onHostEvent, prefsStore, usePrefs, type HostInfo } from './host';
import { handleShellBack } from './lib/back';
import { ImportFlow, importHostFile } from './lib/importFlow';
import { startSync } from './lib/sync';
import { FullSyncDialog } from './ui/FullSyncDialog';
import { UpdateBanner } from './ui/UpdateBanner';
import { useMediaQuery } from './lib/hooks';
import { useLocation } from './lib/router';
import { applyTheme, resolveTheme, THEME_COLOR } from './lib/theme';
import { resolveRoute } from './routes';
import { Shell } from './shell/Shell';
import { Button } from './ui/Button';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { LoadingState } from './ui/Spinner';
import { EmptyState, ErrorState } from './ui/States';
import { Toaster } from './ui/Toast';

type Boot = { state: 'loading' } | { state: 'ready'; info: HostInfo } | { state: 'error'; error: unknown };

export function App() {
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });
  const start = () => {
    setBoot({ state: 'loading' });
    Promise.all([hostInfoStore.load(), prefsStore.load()]).then(
      ([info]) => setBoot({ state: 'ready', info }),
      (error) => setBoot({ state: 'error', error }),
    );
  };
  useEffect(start, []);

  const [prefs] = usePrefs();
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const info = boot.state === 'ready' ? boot.info : null;
  const theme = resolveTheme(prefs.theme, info, systemDark);
  useEffect(() => {
    applyTheme(theme);
    // The shell paints the system bars with the page background.
    if (info) host.ui.state({ theme, background: THEME_COLOR[theme] }).catch(() => {});
  }, [theme, info]);

  // Android back button: in-app back, then acknowledge (`back-ack`); exit on the root screen.
  useEffect(() => onHostEvent('back', (ev) => handleShellBack(ev?.id)), []);
  // A file opened with the app (Android share/open-with): import it.
  useEffect(
    () =>
      onHostEvent('open-file', (f) => {
        if (typeof f.path === 'string') void importHostFile(f.path, typeof f.name === 'string' ? f.name : f.path.split('/').pop() ?? f.path);
      }),
    [],
  );
  useEffect(() => {
    if (boot.state !== 'ready') return;
    startSync();
    // After the first successful render: confirms an OTA bundle to the shell (else it rolls back).
    host.ui.ready(boot.info.uiVersion, ['back-ack']).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot.state]);

  if (boot.state === 'loading') return <LoadingState label="시작하는 중" />;
  if (boot.state === 'error')
    return (
      <>
        <ErrorState error={boot.error} title="앱을 시작하지 못했습니다" onRetry={start} />
        <Toaster />
      </>
    );
  return (
    <>
      <Routed />
      <FullSyncDialog />
      <ImportFlow />
      <UpdateBanner />
      <Toaster />
    </>
  );
}

function Routed() {
  const location = useLocation();
  const { route, params } = resolveRoute(location.path);
  return (
    <Shell tab={route.tab} chrome={route.chrome !== false}>
      <ErrorBoundary resetKey={location.href}>
        {route.name === 'not-found' ? (
          <EmptyState
            title="화면을 찾을 수 없습니다"
            message={`#${location.href}`}
            actions={
              <Button variant="primary" onClick={() => (window.location.hash = '#/decks')}>
                덱 목록으로
              </Button>
            }
          />
        ) : (
          <div className="route" data-route={route.name} key={route.name}>
            {route.render({ params, query: location.query, location })}
          </div>
        )}
      </ErrorBoundary>
    </Shell>
  );
}
