// App-bar sync button: idle, syncing (spinner; static text in e-ink), needs sync
// (dot), error (!). Tap = sync (same flow as 설정 › 동기화, lib/sync.ts); when
// not logged in it opens 설정 › 동기화.
import { useEffect } from 'react';
import { navigate } from '../lib/router';
import { checkSyncNeeded, runSync, syncButtonState, useSyncState } from '../lib/sync';
import { IconButton } from './IconButton';
import { IconSync } from './icons';
import './SyncButton.css';

export function SyncButton() {
  const s = useSyncState();
  const state = syncButtonState(s);
  const loggedIn = !!s.status?.loggedIn;

  useEffect(() => {
    if (loggedIn) void checkSyncNeeded();
  }, [loggedIn]);

  const onClick = () => {
    if (!s.status || !loggedIn) {
      navigate('/settings/sync');
      return;
    }
    if (s.status.running) return;
    void runSync('normal');
  };

  const label =
    state === 'syncing'
      ? s.progress ?? '동기화 중'
      : state === 'error'
        ? `동기화 오류: ${s.status?.lastError ?? '앱 엔진에 연결할 수 없습니다'}`
        : state === 'needed'
          ? '동기화 필요'
          : state === 'logged-out'
            ? 'AnkiWeb 로그인'
            : '동기화';

  return (
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
  );
}
