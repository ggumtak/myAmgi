// App-bar sync button: idle, syncing (spinner; static text in e-ink), needs sync
// (dot), error (!). Tap = sync; when not logged in it opens 설정 › 동기화.
import { useCallback, useEffect, useState } from 'react';
import { host, onHostEvent, type SyncStatus } from '../host';
import { notifyCollectionChanged } from '../lib/hooks';
import { describeError } from '../lib/errors';
import { navigate } from '../lib/router';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { IconSync } from './icons';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import './SyncButton.css';

export function SyncButton() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [askFull, setAskFull] = useState(false);

  const refresh = useCallback(() => {
    host.sync.status().then(
      (s) => {
        setStatus(s);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    refresh();
    return onHostEvent('sync-state', (s) => setStatus((prev) => ({ ...(prev ?? { loggedIn: false, required: 'none', syncing: false }), ...s })));
  }, [refresh]);

  const run = async (mode: 'normal' | 'upload' | 'download') => {
    setStatus((s) => (s ? { ...s, syncing: true, error: null } : s));
    try {
      const res = await host.sync.run(mode);
      if (res.needsFullSync) {
        setAskFull(true);
      } else {
        toast('동기화 완료');
        notifyCollectionChanged();
      }
    } catch (err) {
      toast(`동기화 실패: ${describeError(err).message}`, { kind: 'error' });
      setStatus((s) => (s ? { ...s, error: describeError(err).message } : s));
    } finally {
      refresh();
    }
  };

  const onClick = () => {
    if (!status || !status.loggedIn) {
      navigate('/settings/sync');
      return;
    }
    if (status.syncing) return;
    void run('normal');
  };

  const state = failed || status?.error ? 'error' : status?.syncing ? 'syncing' : status?.required && status.required !== 'none' ? 'needed' : 'idle';
  const label =
    state === 'syncing' ? '동기화 중' : state === 'error' ? '동기화 오류' : state === 'needed' ? '동기화 필요' : status?.loggedIn ? '동기화' : 'AnkiWeb 로그인';

  return (
    <>
      <IconButton label={label} onClick={onClick} className={`sync-btn sync-btn--${state}`} data-testid="sync-button" data-state={state}>
        {state === 'syncing' ? (
          <>
            <IconSync className="sync-btn__spin" />
            <span className="sync-btn__text">동기화 중</span>
          </>
        ) : (
          <IconSync />
        )}
        {state === 'needed' && <span className="sync-btn__dot" aria-hidden="true" />}
        {state === 'error' && (
          <span className="sync-btn__badge" aria-hidden="true">
            !
          </span>
        )}
      </IconButton>
      <Sheet
        open={askFull}
        onClose={() => setAskFull(false)}
        title="전체 동기화가 필요합니다"
        actions={
          <>
            <Button variant="text" onClick={() => setAskFull(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                setAskFull(false);
                void run('download');
              }}
            >
              AnkiWeb에서 내려받기
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setAskFull(false);
                void run('upload');
              }}
            >
              AnkiWeb으로 올리기
            </Button>
          </>
        }
      >
        <p>이 기기와 AnkiWeb의 컬렉션을 합칠 수 없습니다. 어느 쪽을 남길지 고르세요. 고르지 않은 쪽의 변경 내용은 사라집니다.</p>
      </Sheet>
    </>
  );
}
