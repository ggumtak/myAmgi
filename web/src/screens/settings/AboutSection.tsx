// 정보: app version, build, UI bundle version, engine version, last sync,
// update check, copy error log. Data from `host.info`.
import { useState } from 'react';
import { host, hostInfoStore } from '../../host';
import { describeError } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/hooks';
import { Button } from '../../ui/Button';
import { ListRow, ListSection } from '../../ui/ListRow';
import { CopyLogButton } from '../../ui/States';
import { toast } from '../../ui/Toast';

export function AboutSection() {
  const info = useAsync(() => (hostInfoStore.get() ? Promise.resolve(hostInfoStore.get()!) : hostInfoStore.load()), []);
  const sync = useAsync(() => host.sync.status().catch(() => null), []);
  const [checking, setChecking] = useState(false);
  const i = info.data;
  const flavor = i ? (i.flavor === 'comet' ? 'Comet (전자잉크)' : i.flavor === 'pro' ? 'Pro' : i.flavor) : '';
  const lastSync = sync.data?.lastSync ? formatDateTime(sync.data.lastSync) : '없음';

  return (
    <ListSection title="정보">
      <div data-testid="about" className="list-group">
        <ListRow title="앱 버전" trailing={<span data-testid="about-app">{i ? `${i.appVersion} · ${flavor}` : '…'}</span>} />
        <ListRow title="빌드" trailing={<span className="num">{i ? String(i.build) : '…'}</span>} />
        <ListRow title="UI 번들 버전" trailing={<span data-testid="about-ui">{i?.uiVersion ?? '…'}</span>} />
        <ListRow title="엔진 버전" trailing={<span data-testid="about-engine">{i?.backendVersion ?? '…'}</span>} />
        <ListRow title="기기" trailing={i ? `${i.device} (${i.platform === 'android' ? 'Android' : 'PC'})` : '…'} />
        <ListRow title="마지막 동기화" trailing={lastSync} />
        <div className="settings__buttons">
          <Button
            loading={checking}
            onClick={async () => {
              setChecking(true);
              try {
                const u = await host.update.check();
                toast(u.available ? `새 버전이 있습니다: ${u.latest ?? ''}` : '최신 버전입니다');
              } catch (err) {
                toast(`업데이트 확인 실패: ${describeError(err).message}`, { kind: 'error' });
              } finally {
                setChecking(false);
              }
            }}
          >
            업데이트 확인
          </Button>
          <CopyLogButton />
        </div>
      </div>
    </ListSection>
  );
}
