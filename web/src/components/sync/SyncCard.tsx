import type React from 'react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { host, HostApiError, type ProgressEvent, type SyncStatus } from '../../host';
import {
  ActionMenu,
  IconChevronRight,
  IconDownload,
  IconExternal,
  IconEye,
  IconSync,
  IconTrash,
  IconUpload,
  SettingRow,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import './sync.css';

const ANKIWEB_SIGNUP_URL = 'https://ankiweb.net/account/signup';

export function formatSyncTime(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '아직 동기화하지 않음';
  const now = Date.now();
  const diffMs = now - ms;
  if (diffMs >= 0 && diffMs < 60_000) return '방금 전';
  if (diffMs >= 0 && diffMs < 3_600_000) {
    const mins = Math.max(1, Math.floor(diffMs / 60_000));
    return `${mins}분 전`;
  }

  const target = new Date(ms);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();

  const timeStr = target.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (startOfTarget === startOfToday) {
    return `오늘 ${timeStr}`;
  }
  if (startOfTarget === startOfYesterday) {
    return `어제 ${timeStr}`;
  }

  const month = target.getMonth() + 1;
  const day = target.getDate();
  return `${month}월 ${day}일 ${timeStr}`;
}

function formatBytesMb(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1)} MB`;
}

export function formatSyncProgressText(
  status: SyncStatus | null,
  progress: ProgressEvent | null
): string {
  const phase = status?.phase;
  if (phase === 'backup') {
    return '혹시 모를 일을 대비해 안전 백업을 만드는 중…';
  }
  if (phase === 'upload') {
    if (progress?.total && progress.total > 0 && progress.transferred !== undefined) {
      const pct = Math.min(100, Math.round((progress.transferred / progress.total) * 100));
      return `내 기기의 카드를 서버로 올리는 중… (${pct}% · ${formatBytesMb(progress.transferred)})`;
    }
    return '내 기기의 카드를 서버로 올리는 중…';
  }
  if (phase === 'download') {
    if (progress?.total && progress.total > 0 && progress.transferred !== undefined) {
      const pct = Math.min(100, Math.round((progress.transferred / progress.total) * 100));
      return `서버의 카드를 이 기기로 가져오는 중… (${pct}% · ${formatBytesMb(progress.transferred)})`;
    }
    return '서버의 카드를 이 기기로 가져오는 중…';
  }
  if (phase === 'media' || progress?.kind === 'mediaSync') {
    const checked = progress?.checked ?? 0;
    if (checked > 0 || progress?.added || progress?.removed) {
      return `사진과 소리 확인 중… (${checked.toLocaleString('ko-KR')}개 확인)`;
    }
    return '카드 속 사진과 소리를 맞추는 중…';
  }
  if (progress?.kind === 'fullSync' && progress.total && progress.total > 0) {
    const transferred = progress.transferred ?? 0;
    const pct = Math.min(100, Math.round((transferred / progress.total) * 100));
    return `전체 기록을 맞추는 중… (${pct}%)`;
  }
  if (phase === 'collection' || progress?.kind === 'normalSync') {
    const added = Number(progress?.added ?? 0);
    const removed = Number(progress?.removed ?? 0);
    if (added > 0 || removed > 0) {
      return `카드 기록을 맞추는 중… (+${added}, -${removed})`;
    }
    return '바뀐 카드와 학습 기록을 확인하는 중…';
  }
  return '바뀐 카드와 학습 기록을 확인하는 중…';
}

function mapLoginErrorMessage(err: unknown): string {
  if (err instanceof HostApiError) {
    if (err.status === 401) {
      return '아이디 또는 비밀번호가 맞지 않습니다. 다시 확인해 주세요.';
    }
    if (err.status === 502) {
      return '인터넷에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    }
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return '로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

type ConfirmAction = null | 'download' | 'upload' | 'logout';

export const SyncCard: React.FC<{ compact?: boolean; onSuccess?: () => void }> = ({
  compact = false,
  onSuccess,
}) => {
  const {
    prefs,
    setPref,
    resolvedTheme,
    syncStatus,
    syncProgress,
    refreshSyncStatus,
    openFullSyncDialog,
    bumpCollection,
  } = useApp();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [manualRunning, setManualRunning] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const isEink = resolvedTheme === 'eink';
  const isLoggedIn = Boolean(syncStatus?.loggedIn);
  const isRunning = Boolean(syncStatus?.running) || manualRunning;

  const autoSync = prefs['sync.auto'] === true;
  const mediaSync = prefs['sync.media'] !== false;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggingIn) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLoginError('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setLoginError(null);
    setLoggingIn(true);
    try {
      await host.syncLogin({ user: trimmedEmail, password });
      setPassword('');
      setShowPw(false);
      await setPref('sync.auto', true);
      await refreshSyncStatus();

      try {
        const res = await host.syncRun('normal');
        await refreshSyncStatus();
        if (res.needsFullSync) {
          openFullSyncDialog();
          onSuccess?.();
        } else {
          bumpCollection();
          showToast('연결 완료 · 동기화를 마쳤습니다.', 'success');
          onSuccess?.();
        }
      } catch (syncErr) {
        await refreshSyncStatus().catch(() => undefined);
        if (syncErr instanceof HostApiError && syncErr.status === 409) {
          showToast('동기화를 중단했습니다.', 'info');
        } else {
          const msg =
            syncErr instanceof Error
              ? syncErr.message
              : '연결은 되었지만 동기화에 실패했습니다.';
          showToast(msg, 'error');
        }
      }
    } catch (err) {
      setLoginError(mapLoginErrorMessage(err));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleOpenSignup = async () => {
    try {
      await host.platformOpenExternal(ANKIWEB_SIGNUP_URL);
    } catch {
      window.open(ANKIWEB_SIGNUP_URL, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRunNormalSync = async () => {
    if (isRunning) return;
    setManualRunning(true);
    try {
      const res = await host.syncRun('normal');
      await refreshSyncStatus();
      if (res.needsFullSync) {
        openFullSyncDialog();
      } else {
        bumpCollection();
        showToast('동기화를 마쳤습니다.', 'success');
        onSuccess?.();
      }
    } catch (err) {
      await refreshSyncStatus().catch(() => undefined);
      if (err instanceof HostApiError && err.status === 409) {
        showToast('동기화를 중단했습니다.', 'info');
      } else {
        showToast(
          err instanceof Error ? err.message : '동기화를 끝내지 못했습니다.',
          'error'
        );
      }
    } finally {
      setManualRunning(false);
    }
  };

  const handleAbort = async () => {
    if (aborting) return;
    setAborting(true);
    try {
      await host.syncAbort();
      await refreshSyncStatus();
      showToast('동기화를 중단했습니다.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '동기화를 중단하지 못했습니다.',
        'error'
      );
    } finally {
      setAborting(false);
    }
  };

  const handleExecuteConfirm = async () => {
    if (!confirmAction || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirmAction === 'logout') {
        await host.syncLogout();
        await setPref('sync.auto', false);
        await refreshSyncStatus();
        setConfirmAction(null);
        showToast('AnkiWeb 계정 연결을 해제했습니다.', 'info');
      } else {
        const mode = confirmAction;
        setConfirmAction(null);
        setManualRunning(true);
        try {
          await host.syncRun(mode);
          await refreshSyncStatus();
          bumpCollection();
          showToast(
            mode === 'download'
              ? '서버에서 카드와 기록을 가져왔습니다.'
              : '이 기기의 카드와 기록을 서버로 보냈습니다.',
            'success'
          );
          onSuccess?.();
        } finally {
          setManualRunning(false);
        }
      }
    } catch (err) {
      await refreshSyncStatus().catch(() => undefined);
      if (err instanceof HostApiError && err.status === 409) {
        showToast('동기화를 중단했습니다.', 'info');
      } else {
        showToast(
          err instanceof Error ? err.message : '요청을 처리하지 못했습니다.',
          'error'
        );
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className={`amgi-sync-card ${compact ? 'amgi-sync-card--compact' : ''}`}>
        <div className="amgi-sync-card-head">
          <h4 className="amgi-sync-card-title">AnkiWeb 계정 연결</h4>
          <p className="amgi-sync-card-sub">
            로그인하면 모든 기기에서 카드와 학습 기록이 자동으로 맞춰집니다.
          </p>
        </div>

        {loginError && (
          <div className="amgi-sync-banner amgi-sync-banner--error" role="alert">
            {loginError}
          </div>
        )}

        <form className="amgi-sync-form" onSubmit={handleLoginSubmit} noValidate>
          <div className="amgi-sync-field">
            <label htmlFor="sync-email" className="amgi-sync-label">
              아이디 (이메일)
            </label>
            <input
              id="sync-email"
              type="email"
              className="amgi-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (loginError) setLoginError(null);
              }}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              disabled={loggingIn}
            />
          </div>

          <div className="amgi-sync-field">
            <label htmlFor="sync-password" className="amgi-sync-label">
              비밀번호
            </label>
            <div className="amgi-sync-pw-wrap">
              <input
                id="sync-password"
                type={showPw ? 'text' : 'password'}
                className="amgi-input"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (loginError) setLoginError(null);
                }}
                autoComplete="current-password"
                disabled={loggingIn}
              />
              <button
                type="button"
                className="amgi-sync-pw-toggle"
                onClick={() => setShowPw((prev) => !prev)}
                aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                aria-pressed={showPw}
                disabled={loggingIn}
                data-compact="true"
              >
                {!isEink && <IconEye size={16} />}
                <span>{showPw ? '숨김' : '보기'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="amgi-btn amgi-btn-primary amgi-sync-submit"
            disabled={loggingIn}
          >
            {loggingIn && !isEink && <IconSync size={18} className="amgi-spin" />}
            <span>{loggingIn ? '연결하는 중...' : '로그인'}</span>
          </button>
        </form>

        <div className="amgi-sync-signup-row">
          <span className="amgi-sync-signup-prompt">계정이 없나요?</span>
          <button
            type="button"
            className="amgi-btn amgi-btn-ghost amgi-sync-signup-btn"
            onClick={() => void handleOpenSignup()}
          >
            <span>무료 계정 만들기</span>
            <IconExternal size={15} />
          </button>
        </div>
      </div>
    );
  }

  const pillClass = isRunning
    ? 'amgi-sync-pill amgi-sync-pill--running'
    : syncStatus?.needsFullSync
      ? 'amgi-sync-pill amgi-sync-pill--warn'
      : syncStatus?.lastError
        ? 'amgi-sync-pill amgi-sync-pill--error'
        : 'amgi-sync-pill';

  const pillLabel = isRunning
    ? '동기화 중'
    : syncStatus?.needsFullSync
      ? '선택 필요'
      : syncStatus?.lastError
        ? '확인 필요'
        : '연결됨';

  return (
    <div className={`amgi-sync-card ${compact ? 'amgi-sync-card--compact' : ''}`}>
      <div className="amgi-sync-connected-top">
        <div className="amgi-sync-account-info">
          <span className={pillClass}>
            <span className="amgi-sync-pill-dot" aria-hidden="true" />
            <span>{pillLabel}</span>
          </span>
          <div className="amgi-sync-email">{syncStatus?.user || 'AnkiWeb 계정'}</div>
          <div className="amgi-sync-last-time">
            마지막 동기화: {formatSyncTime(syncStatus?.lastSync)}
          </div>
        </div>

        {!isRunning && (
          <button
            type="button"
            className="amgi-btn amgi-btn-primary amgi-sync-now-btn"
            onClick={() => void handleRunNormalSync()}
          >
            <IconSync size={17} />
            <span>지금 동기화</span>
          </button>
        )}
      </div>

      {isRunning && (
        <div className="amgi-sync-banner amgi-sync-banner--progress" role="status">
          <div className="amgi-sync-progress-head">
            <span className="amgi-sync-progress-title">
              {!isEink && <IconSync size={16} className="amgi-spin" />}
              <span>동기화하는 중...</span>
            </span>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              onClick={() => void handleAbort()}
              disabled={aborting}
            >
              {aborting ? '중단 중...' : '중단'}
            </button>
          </div>
          <div className="amgi-sync-progress-text">
            {formatSyncProgressText(syncStatus, syncProgress)}
          </div>
        </div>
      )}

      {!isRunning && syncStatus?.needsFullSync && (
        <div className="amgi-sync-banner amgi-sync-banner--warn" role="alert">
          <div>이 기기와 서버 기록 중 어느 쪽을 남길지 선택해 주세요.</div>
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary amgi-btn-sm"
            onClick={openFullSyncDialog}
            style={{ alignSelf: 'flex-start' }}
          >
            선택 화면 열기
          </button>
        </div>
      )}

      {!isRunning && syncStatus?.lastError && !syncStatus?.needsFullSync && (
        <div className="amgi-sync-banner amgi-sync-banner--error" role="alert">
          <div>
            <strong>동기화를 끝내지 못했어요</strong>
          </div>
          <div>{syncStatus.lastError}</div>
        </div>
      )}

      <div className="amgi-sync-rows">
        <SettingRow
          label="자동 동기화"
          description="앱을 열거나 닫을 때 자동으로 맞춥니다"
          htmlFor="pref-sync-auto"
          control={
            <Switch
              id="pref-sync-auto"
              checked={autoSync}
              onChange={(next) => void setPref('sync.auto', next)}
            />
          }
        />
        <SettingRow
          label="사진·소리 함께 맞추기"
          description="카드 속 이미지와 음성을 함께 동기화합니다"
          htmlFor="pref-sync-media"
          control={
            <Switch
              id="pref-sync-media"
              checked={mediaSync}
              onChange={(next) => void setPref('sync.media', next)}
            />
          }
        />
        <SettingRow
          label="계정 및 전체 동기화"
          description="연결 끊기 또는 한쪽으로 덮어쓰기"
          onClick={() => setActionsMenuOpen(true)}
          disabled={isRunning}
          control={<IconChevronRight size={18} />}
        />
      </div>

      <ActionMenu
        open={actionsMenuOpen}
        onClose={() => setActionsMenuOpen(false)}
        title="계정 및 전체 동기화"
        subtitle={syncStatus?.user || undefined}
        items={[
          {
            id: 'download',
            label: '서버에서 전체 다시 가져오기',
            description: '현재 기기를 자동 백업한 뒤 서버 내용으로 덮어씁니다',
            icon: <IconDownload size={18} />,
            onSelect: () => setConfirmAction('download'),
          },
          {
            id: 'upload',
            label: '서버로 전체 다시 보내기',
            description: '이 기기의 내용으로 AnkiWeb 서버를 덮어씁니다',
            icon: <IconUpload size={18} />,
            onSelect: () => setConfirmAction('upload'),
          },
          {
            id: 'logout',
            label: '계정 연결 끊기',
            description: '내 기기의 카드는 지워지지 않고 연결만 해제됩니다',
            icon: <IconTrash size={18} />,
            destructive: true,
            onSelect: () => setConfirmAction('logout'),
          },
        ]}
      />

      <SheetOrDialog
        open={confirmAction !== null}
        onClose={() => {
          if (!confirmBusy) setConfirmAction(null);
        }}
        title={
          confirmAction === 'download'
            ? '서버에서 전체 다시 가져올까요?'
            : confirmAction === 'upload'
              ? '서버로 전체 다시 보낼까요?'
              : 'AnkiWeb 연결을 끊을까요?'
        }
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={confirmBusy}
              onClick={() => setConfirmAction(null)}
            >
              취소
            </button>
            <button
              type="button"
              className={`amgi-btn ${
                confirmAction === 'logout' ? 'amgi-btn-danger' : 'amgi-btn-primary'
              }`}
              disabled={confirmBusy}
              onClick={() => void handleExecuteConfirm()}
            >
              {confirmBusy
                ? '처리 중...'
                : confirmAction === 'download'
                  ? '가져오기'
                  : confirmAction === 'upload'
                    ? '보내기'
                    : '연결 끊기'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          {confirmAction === 'download' &&
            '지금 기기의 상태를 먼저 안전 백업으로 저장한 뒤, AnkiWeb 서버의 최신 카드와 기록으로 이 기기를 덮어씁니다.'}
          {confirmAction === 'upload' &&
            '지금 이 기기에 저장된 카드와 학습 기록으로 AnkiWeb 서버 내용을 덮어씁니다. 다른 기기에만 있던 변경 사항은 사라집니다.'}
          {confirmAction === 'logout' &&
            'AnkiWeb 계정 연결만 해제합니다. 이 기기에 저장된 카드와 학습 기록은 그대로 유지됩니다.'}
        </p>
      </SheetOrDialog>
    </div>
  );
};
