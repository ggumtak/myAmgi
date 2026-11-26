// Non-blocking "새 화면으로 다시 열기" bar: shown when the shell reports (event `update`)
// that a new UI bundle was installed after this page loaded. `update.apply {kind: "ota"}`
// makes the shell reload into it.
import { useEffect, useState } from 'react';
import { host, onHostEvent, type UpdateStatus } from '../host';
import { describeError } from '../lib/errors';
import { Button } from './Button';
import { toast } from './Toast';
import './UpdateBanner.css';

export function uiReloadNeeded(s: UpdateStatus | null | undefined): boolean {
  return !!s && (s.ui?.reloadNeeded === true || (s.kind === 'ota' && s.available === true));
}

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      onHostEvent('update', (s) => {
        setStatus(s);
        if (uiReloadNeeded(s)) setDismissed(false);
      }),
    [],
  );
  if (!uiReloadNeeded(status) || dismissed) return null;
  return (
    <div className="update-banner" role="status" data-testid="update-banner">
      <span className="update-banner__text">새 화면이 준비되었습니다{status?.ui?.downloaded ? ` (${status.ui.downloaded})` : ''}</span>
      <Button variant="text" onClick={() => setDismissed(true)}>
        나중에
      </Button>
      <Button
        variant="primary"
        loading={busy}
        data-testid="update-reload"
        onClick={async () => {
          setBusy(true);
          try {
            await host.update.apply('ota');
          } catch (err) {
            toast(`다시 열지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
          } finally {
            setBusy(false);
          }
        }}
      >
        새 화면으로 다시 열기
      </Button>
    </div>
  );
}
