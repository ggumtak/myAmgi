// 설정 › 동기화: AnkiWeb login (id, password, optional custom server), status,
// "지금 동기화" with progress from host events, media sync toggle, full sync
// (direction dialog), logout. Same flow as the app-bar sync button (lib/sync.ts).
import { useState } from 'react';
import { host, usePrefs } from '../../host';
import { describeError } from '../../lib/errors';
import { formatDateTimeMs } from '../../lib/format';
import { openFullSyncDialog, PHASE_LABEL, refreshSync, runSync, useSyncState } from '../../lib/sync';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialogs';
import { ListRow, ListSection } from '../../ui/ListRow';
import { LoadingState } from '../../ui/Spinner';
import { ErrorState } from '../../ui/States';
import { toast } from '../../ui/Toast';
import { Toggle } from './Toggle';
import './Settings.css';

function LoginForm() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [custom, setCustom] = useState(false);
  const [endpoint, setEndpoint] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!user.trim() || !password) {
      setError('아이디와 비밀번호를 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await host.sync.login(user.trim(), password, custom ? endpoint.trim() : null);
      setPassword('');
      await refreshSync();
      toast('AnkiWeb에 로그인했습니다');
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="settings__form"
      data-testid="sync-login"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="settings__note">AnkiWeb 계정으로 로그인하면 이 기기와 Anki 데스크톱·AnkiDroid·AnkiWeb의 카드가 같아집니다.</p>
      <div className="field">
        <label className="field__label" htmlFor="sync-user">
          아이디 (이메일)
        </label>
        <input id="sync-user" className="field__input" type="email" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="sync-password">
          비밀번호
        </label>
        <input
          id="sync-password"
          className="field__input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <label className="settings__check">
        <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} data-testid="sync-custom-server" />
        <span>직접 운영하는 동기화 서버 사용</span>
      </label>
      {custom && (
        <div className="field">
          <label className="field__label" htmlFor="sync-endpoint">
            서버 주소
          </label>
          <input
            id="sync-endpoint"
            className="field__input"
            type="url"
            inputMode="url"
            placeholder="https://example.com/"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </div>
      )}
      {error && (
        <div className="field__error" role="alert" data-testid="sync-login-error">
          {error}
        </div>
      )}
      <div className="settings__buttons settings__buttons--flush">
        <Button type="submit" variant="primary" loading={busy} data-testid="sync-login-submit">
          로그인
        </Button>
      </div>
    </form>
  );
}

export function SyncSettingsScreen() {
  const s = useSyncState();
  const [prefs, setPrefs] = usePrefs();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const status = s.status;

  let body;
  if (!status && s.unreachable) {
    body = <ErrorState error={new Error('동기화 상태를 읽지 못했습니다')} title="동기화 상태를 읽지 못했습니다" onRetry={() => void refreshSync()} />;
  } else if (!status) {
    body = <LoadingState />;
  } else {
    const running = status.running;
    body = (
      <>
        <ListSection title="AnkiWeb">
          {!status.loggedIn ? (
            <>
              {status.lastError && (
                <p className="settings__error" role="alert" data-testid="sync-error">
                  {status.lastError}
                </p>
              )}
              <LoginForm />
            </>
          ) : (
            <div data-testid="sync-account">
              <ListRow title="계정" trailing={<span data-testid="sync-user">{status.user}</span>} />
              <ListRow title="서버" trailing={status.endpoint ?? 'AnkiWeb'} />
              <ListRow title="마지막 동기화" trailing={<span data-testid="sync-last">{status.lastSync ? formatDateTimeMs(status.lastSync) : '없음'}</span>} />
              <div className="settings__status" data-testid="sync-status" aria-live="polite">
                {running ? (
                  <>
                    <span>{s.progress ?? PHASE_LABEL[status.phase] ?? '동기화 중'}</span>
                    <progress className="settings__progress" max={1} value={s.fraction ?? undefined} />
                  </>
                ) : status.lastError ? (
                  <span className="settings__error" role="alert" data-testid="sync-error">
                    {status.lastError}
                  </span>
                ) : status.needsFullSync ? (
                  <span>전체 동기화가 필요합니다. 아래 "지금 동기화"를 누르고 방향을 고르세요.</span>
                ) : (
                  <span>{status.lastSync ? '동기화되어 있습니다.' : '아직 동기화하지 않았습니다.'}</span>
                )}
              </div>
              <div className="settings__buttons">
                {running ? (
                  <Button onClick={() => void host.sync.abort().catch((err) => toast(describeError(err).message, { kind: 'error' }))} data-testid="sync-abort">
                    취소
                  </Button>
                ) : (
                  <Button variant="primary" onClick={() => void runSync('normal')} data-testid="sync-now">
                    지금 동기화
                  </Button>
                )}
                <Button variant="text" disabled={running} onClick={() => setConfirmLogout(true)} data-testid="sync-logout">
                  로그아웃
                </Button>
              </div>
            </div>
          )}
        </ListSection>

        <ListSection title="설정">
          <Toggle
            label="미디어 동기화"
            hint="소리·그림 파일도 함께 동기화합니다"
            checked={prefs['sync.media'] !== false}
            onChange={(v) => setPrefs({ 'sync.media': v }).catch((err) => toast(`저장하지 못했습니다: ${describeError(err).message}`, { kind: 'error' }))}
            testId="pref-sync-media"
          />
        </ListSection>

        {status.loggedIn && (
          <ListSection title="전체 동기화">
            <p className="settings__note">평소에는 필요 없습니다. 한쪽 컬렉션을 다른 쪽 내용으로 통째로 바꿀 때만 쓰세요.</p>
            <div className="settings__buttons">
              <Button disabled={running} onClick={() => openFullSyncDialog('manual')} data-testid="sync-full">
                전체 올리기/내려받기…
              </Button>
            </div>
          </ListSection>
        )}
      </>
    );
  }

  return (
    <div className="screen">
      <AppBar title="동기화" back />
      <div className="screen__body settings" data-testid="sync-settings">
        {body}
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title="AnkiWeb에서 로그아웃"
        message={<p>'{status?.user}' 계정에서 로그아웃합니다. 이 기기의 카드는 그대로 남습니다.</p>}
        confirmLabel="로그아웃"
        onConfirm={async () => {
          try {
            await host.sync.logout();
            await refreshSync();
            toast('로그아웃했습니다');
          } catch (err) {
            toast(describeError(err).message, { kind: 'error' });
          }
          setConfirmLogout(false);
        }}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}
