// 정보: app version, build, UI bundle version, engine version, last sync,
// update check (`update.*`; "이 기기에서는 지원하지 않습니다" where the shell has
// no updater, e.g. PC), copy error log (`log.get`).
import { useEffect, useState } from 'react';
import { host, HostError, hostInfoStore, onHostEvent, type UpdateStatus } from '../../host';
import { describeError } from '../../lib/errors';
import { formatDateTimeMs } from '../../lib/format';
import { useAsync } from '../../lib/hooks';
import { useSyncState } from '../../lib/sync';
import { Button } from '../../ui/Button';
import { ListRow, ListSection } from '../../ui/ListRow';
import { CopyLogButton } from '../../ui/States';
import { toast } from '../../ui/Toast';

const UNSUPPORTED = '이 기기에서는 지원하지 않습니다';

type Update = { state: 'idle' } | { state: 'checking' } | { state: 'done'; message: string; status?: UpdateStatus } | { state: 'applying' };

export function AboutSection() {
  const info = useAsync(() => (hostInfoStore.get() ? Promise.resolve(hostInfoStore.get()!) : hostInfoStore.load()), []);
  const sync = useSyncState();
  const [update, setUpdate] = useState<Update>({ state: 'idle' });
  // Shell update state (Android: APK + OTA UI bundle); null where unsupported (PC).
  const [shell, setShell] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    host.update.status().then((s) => setShell(s.supported === false ? null : s), () => setShell(null));
    return onHostEvent('update', setShell);
  }, []);
  const i = info.data;
  const flavor = i ? ({ comet: 'Comet (전자잉크)', pro: 'Pro', desktop: 'PC' } as Record<string, string>)[i.flavor] ?? i.flavor : '';
  const lastSync = sync.status?.lastSync ? formatDateTimeMs(sync.status.lastSync) : '없음';

  const check = async () => {
    setUpdate({ state: 'checking' });
    try {
      const st = await host.update.status();
      if (st.supported === false) {
        setUpdate({ state: 'done', message: UNSUPPORTED });
        return;
      }
      const u = await host.update.check();
      setShell(u);
      setUpdate(
        u.available
          ? { state: 'done', message: `${u.kind === 'ota' ? '새 화면' : '새 버전'}이 있습니다${u.latest ? `: ${u.latest}` : ''}`, status: u }
          : { state: 'done', message: '최신 버전입니다' },
      );
    } catch (err) {
      setUpdate({ state: 'done', message: err instanceof HostError && err.unsupported ? UNSUPPORTED : `업데이트 확인 실패: ${describeError(err).message}` });
    }
  };

  const apply = async () => {
    if (update.state !== 'done') return;
    setUpdate({ state: 'applying' });
    try {
      await host.update.apply(update.state === 'done' && update.status?.kind ? update.status.kind : undefined);
      setUpdate({ state: 'done', message: '업데이트를 시작했습니다' });
    } catch (err) {
      toast(`업데이트하지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
      setUpdate({ state: 'idle' });
    }
  };

  return (
    <ListSection title="정보">
      <div data-testid="about" className="list-group">
        <ListRow title="앱 버전" trailing={<span data-testid="about-app">{i ? `${i.appVersion} · ${flavor}` : '…'}</span>} />
        <ListRow title="빌드" trailing={<span className="num" data-testid="about-build">{i ? String(i.build) : '…'}</span>} />
        <ListRow title="UI 번들 버전" trailing={<span data-testid="about-ui">{i ? i.uiVersion ?? '없음' : '…'}</span>} />
        <ListRow title="엔진 버전" trailing={<span data-testid="about-engine">{i?.backendVersion ?? '…'}</span>} />
        <ListRow title="기기" trailing={i ? `${i.device} (${i.platform === 'android' ? 'Android' : 'PC'})` : '…'} />
        <ListRow title="마지막 동기화" trailing={<span data-testid="about-last-sync">{lastSync}</span>} />
        {shell && (
          <>
            <ListRow
              title="앱 업데이트 (APK)"
              trailing={
                <span data-testid="about-update-apk">
                  {shell.apk?.available ? `새 버전 빌드 ${shell.apk.latestBuild ?? ''}` : shell.lastCheck ? '최신' : '확인 전'}
                </span>
              }
            />
            <ListRow
              title="화면 업데이트 (UI 번들)"
              trailing={
                <span data-testid="about-update-ota">
                  {shell.ui?.reloadNeeded
                    ? `새 화면 ${shell.ui.downloaded ?? ''} · 다시 열면 적용`
                    : shell.ui?.source === 'ota'
                      ? `받은 화면 ${shell.ui.version ?? ''}`
                      : '기본 화면'}
                </span>
              }
            />
            {shell.running && <ListRow title="업데이트 진행" trailing={`${shell.phase ?? ''}${shell.percent != null ? ` ${shell.percent}%` : ''}`} />}
            {shell.lastError && <p className="settings__error settings__note">{shell.lastError}</p>}
          </>
        )}
        {update.state === 'done' && (
          <p className="settings__note" role="status" data-testid="update-result">
            {update.message}
          </p>
        )}
        <div className="settings__buttons">
          {update.state === 'done' && update.status?.available ? (
            <Button variant="primary" onClick={apply} data-testid="update-apply">
              업데이트
            </Button>
          ) : (
            <Button loading={update.state === 'checking' || update.state === 'applying'} onClick={check} data-testid="update-check">
              업데이트 확인
            </Button>
          )}
          <CopyLogButton />
        </div>
      </div>
    </ListSection>
  );
}
