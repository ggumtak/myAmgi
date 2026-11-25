// 설정 › 백업: "지금 백업", the list of backups (newest first), restore with a
// confirmation naming the backup date, and how many backups to keep.
// Backups are `.colpkg` files without media in the host's data dir (BackupService.kt).
import { useState } from 'react';
import { host, usePrefs, type BackupEntry } from '../../host';
import { describeError } from '../../lib/errors';
import { backupDate, formatBytes } from '../../lib/format';
import { notifyCollectionChanged, useAsync } from '../../lib/hooks';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialogs';
import { ListRow, ListSection } from '../../ui/ListRow';
import { LoadingState } from '../../ui/Spinner';
import { EmptyState, ErrorState } from '../../ui/States';
import { toast } from '../../ui/Toast';
import './Settings.css';

const KEEP_CHOICES = [5, 10, 20, 30, 50, 100];

export function BackupScreen() {
  const list = useAsync(() => host.backup.list(), []);
  const [, setPrefs] = usePrefs();
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<BackupEntry | null>(null);

  const create = async () => {
    setCreating(true);
    try {
      const b = await host.backup.create();
      toast(`백업했습니다: ${backupDate(b.name, b.time)}`);
      list.reload();
    } catch (err) {
      toast(`백업하지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const keep = list.data?.keep ?? 20;
  const keepChoices = KEEP_CHOICES.includes(keep) ? KEEP_CHOICES : [...KEEP_CHOICES, keep].sort((a, b) => a - b);

  let body;
  if (list.error && !list.data) {
    body = <ErrorState error={list.error} title="백업 목록을 불러오지 못했습니다" onRetry={list.reload} />;
  } else if (!list.data) {
    body = <LoadingState />;
  } else {
    const backups = list.data.backups;
    body = (
      <>
        <ListSection title="백업">
          <p className="settings__note">
            컬렉션(소리·그림 파일 제외)을 이 기기에 저장합니다. 전체 내려받기, 복원, .colpkg 가져오기 전에는 자동으로 백업합니다.
          </p>
          <div className="settings__buttons">
            <Button variant="primary" loading={creating} onClick={create} data-testid="backup-now">
              지금 백업
            </Button>
          </div>
          <label className="toggle-row">
            <span className="toggle-row__text">
              <span>보관할 백업 수</span>
              <span className="toggle-row__hint">이보다 오래된 백업은 새 백업을 만들 때 지웁니다</span>
            </span>
            <select
              className="settings__select"
              value={keep}
              data-testid="backup-keep"
              onChange={async (e) => {
                try {
                  await setPrefs({ 'backup.keep': Number(e.target.value) });
                  list.reload();
                } catch (err) {
                  toast(`저장하지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
                }
              }}
            >
              {keepChoices.map((n) => (
                <option key={n} value={n}>
                  {n}개
                </option>
              ))}
            </select>
          </label>
        </ListSection>
        <ListSection title={`백업 목록 (${backups.length}개)`}>
          {backups.length === 0 ? (
            <EmptyState title="백업이 없습니다" message='"지금 백업"을 누르면 여기에 나타납니다.' />
          ) : (
            <div data-testid="backup-list">
              {backups.map((b) => (
                <ListRow
                  key={b.name}
                  testId="backup-row"
                  title={backupDate(b.name, b.time)}
                  subtitle={`${formatBytes(b.size)} · ${b.name}`}
                  trailing={
                    <Button variant="secondary" onClick={() => setRestoring(b)} data-testid="backup-restore">
                      복원
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </ListSection>
      </>
    );
  }

  return (
    <div className="screen">
      <AppBar title="백업" back />
      <div className="screen__body settings" data-testid="backup-screen">
        {body}
      </div>
      <ConfirmDialog
        open={!!restoring}
        title="백업에서 복원"
        danger
        confirmLabel="복원"
        message={
          restoring && (
            <>
              <p data-testid="restore-message">'{backupDate(restoring.name, restoring.time)}' 백업으로 컬렉션 전체를 되돌립니다.</p>
              <p className="field__hint">그 뒤에 바뀐 카드와 학습 기록은 사라집니다. 복원하기 전에 지금 컬렉션을 자동으로 백업합니다.</p>
            </>
          )
        }
        onConfirm={async () => {
          const b = restoring!;
          try {
            await host.backup.restore(b.name);
            notifyCollectionChanged();
            toast(`'${backupDate(b.name, b.time)}' 백업으로 복원했습니다`);
          } catch (err) {
            toast(`복원하지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
          }
          setRestoring(null);
          list.reload();
        }}
        onClose={() => setRestoring(null)}
      />
    </div>
  );
}
