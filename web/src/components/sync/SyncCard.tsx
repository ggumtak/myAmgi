import type React from 'react';
import { useId, useState } from 'react';
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

export function extractCount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : null;
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const match = /(\d[\d,]*)/.exec(trimmed);
  if (!match) return null;
  const num = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : null;
}

function formatMediaCounterSummary(
  checkedRaw: string | number | null | undefined,
  addedRaw: string | number | null | undefined,
  removedRaw: string | number | null | undefined
): string | null {
  const checked = extractCount(checkedRaw);
  const added = extractCount(addedRaw);
  const removed = extractCount(removedRaw);

  const parts: string[] = [];
  if (checked !== null && checked > 0) {
    parts.push(`확인 ${checked.toLocaleString('ko-KR')}`);
  }
  if (added !== null && added > 0) {
    parts.push(`추가 ${added.toLocaleString('ko-KR')}`);
  }
  if (removed !== null && removed > 0) {
    parts.push(`삭제 ${removed.toLocaleString('ko-KR')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function formatMediaProgressText(
  status: SyncStatus | null,
  mediaProgress?: ProgressEvent | null
): string {
  const summary = formatMediaCounterSummary(
    mediaProgress?.checked ?? status?.mediaChecked,
    mediaProgress?.added ?? status?.mediaAdded,
    mediaProgress?.removed ?? status?.mediaRemoved
  );
  if (summary) {
    return `미디어 백그라운드 동기화 · ${summary}`;
  }
  return '미디어 백그라운드 동기화 중…';
}

export function formatSyncProgressText(
  status: SyncStatus | null,
  progress: ProgressEvent | null,
  mediaProgress?: ProgressEvent | null
): string {
  const phase = status?.phase;
  if (!status?.running && status?.mediaRunning) {
    return formatMediaProgressText(status, mediaProgress ?? progress);
  }
  if (phase === 'backup') {
    return '안전 백업을 만드는 중…';
  }
  if (phase === 'upload') {
    if (progress?.total && progress.total > 0 && progress.transferred !== undefined) {
      const pct = Math.min(100, Math.round((progress.transferred / progress.total) * 100));
      return `서버로 업로드 중… (${pct}% · ${formatBytesMb(progress.transferred)})`;
    }
    return '내 기기의 카드를 서버로 올리는 중…';
  }
  if (phase === 'download') {
    if (progress?.total && progress.total > 0 && progress.transferred !== undefined) {
      const pct = Math.min(100, Math.round((progress.transferred / progress.total) * 100));
      return `서버에서 가져오는 중… (${pct}% · ${formatBytesMb(progress.transferred)})`;
    }
    return '서버의 카드를 이 기기로 가져오는 중…';
  }
  if (phase === 'media' || progress?.kind === 'mediaSync') {
    const summary = formatMediaCounterSummary(
      progress?.checked ?? mediaProgress?.checked ?? status?.mediaChecked,
      progress?.added ?? mediaProgress?.added ?? status?.mediaAdded,
      progress?.removed ?? mediaProgress?.removed ?? status?.mediaRemoved
    );
    if (summary) {
      return `사진·소리 동기화 · ${summary}`;
    }
    return '카드 속 사진과 소리를 맞추는 중…';
  }
  if (progress?.kind === 'fullSync' && progress.total && progress.total > 0) {
    const transferred = progress.transferred ?? 0;
    const pct = Math.min(100, Math.round((transferred / progress.total) * 100));
    return `전체 기록을 맞추는 중… (${pct}%)`;
  }
  if (phase === 'collection' || progress?.kind === 'normalSync') {
    const added = extractCount(progress?.added);
    const removed = extractCount(progress?.removed);
    const parts: string[] = [];
    if (added !== null && added > 0) parts.push(`추가 ${added.toLocaleString('ko-KR')}`);
    if (removed !== null && removed > 0) parts.push(`삭제 ${removed.toLocaleString('ko-KR')}`);
    if (parts.length > 0) {
      return `카드 기록 동기화 · ${parts.join(' · ')}`;
    }
    return '카드와 학습 기록을 맞추는 중…';
  }
  return '카드와 학습 기록을 맞추는 중…';
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
    mediaSyncProgress,
    refreshSyncStatus,
    startBackgroundSync,
    startMediaSync,
    abortMediaSync,
    openFullSyncDialog,
  } = useApp();
  const { showToast } = useToast();

  // Unique per instance: SyncCard is mounted in Settings and in the sync sheet at once.
  const idBase = useId();
  const emailId = `${idBase}-email`;
  const passwordId = `${idBase}-password`;
  const autoSyncId = `${idBase}-auto`;
  const mediaSyncId = `${idBase}-media`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loginExpanded, setLoginExpanded] = useState(compact);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [aborting, setAborting] = useState(false);
  const [mediaAborting, setMediaAborting] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const isEink = resolvedTheme === 'eink';
  const isLoggedIn = Boolean(syncStatus?.loggedIn);
  const isRunning = Boolean(syncStatus?.running);
  const isMediaRunning = Boolean(syncStatus?.mediaRunning);

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
      onSuccess?.();
      startBackgroundSync('normal');
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

  const handleRunNormalSync = () => {
    if (isRunning) return;
    startBackgroundSync('normal');
    if (compact) onSuccess?.();
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

  const handleAbortMedia = async () => {
    if (mediaAborting) return;
    setMediaAborting(true);
    try {
      await abortMediaSync();
    } finally {
      setMediaAborting(false);
    }
  };

  const handleExecuteConfirm = async () => {
    if (!confirmAction || confirmBusy) return;
    if (confirmAction !== 'logout') {
      const mode = confirmAction;
      setConfirmAction(null);
      startBackgroundSync(mode);
      if (compact) onSuccess?.();
      return;
    }

    setConfirmBusy(true);
    try {
      await host.syncLogout();
      await setPref('sync.auto', false);
      await refreshSyncStatus();
      setConfirmAction(null);
      showToast('AnkiWeb 계정 연결을 해제했습니다.', 'info');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '요청을 처리하지 못했습니다.',
        'error'
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!isLoggedIn) {
    if (!loginExpanded && !compact) {
      return (
        <div className="amgi-sync-card amgi-sync-card--teaser">
          <div className="amgi-sync-teaser-row">
            <div className="amgi-sync-teaser-icon" aria-hidden="true">
              <IconSync size={20} />
            </div>
            <div className="amgi-sync-card-head" style={{ flex: 1, minWidth: 0 }}>
              <h4 className="amgi-sync-card-title">AnkiWeb 동기화</h4>
              <p className="amgi-sync-card-sub">
                계정을 연결하면 폰·태블릿·PC·전자책의 암기 기록이 자동으로 맞춰집니다.
              </p>
            </div>
          </div>
          <div className="amgi-sync-teaser-actions">
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              style={{ flex: 1 }}
              onClick={() => setLoginExpanded(true)}
            >
              <IconSync size={17} />
              <span>AnkiWeb 로그인</span>
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => void handleOpenSignup()}
            >
              <span>계정 만들기</span>
              <IconExternal size={15} />
            </button>
          </div>
        </div>
      );
    }

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
            <label htmlFor={emailId} className="amgi-sync-label">
              아이디 (이메일)
            </label>
            <input
              id={emailId}
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
            <label htmlFor={passwordId} className="amgi-sync-label">
              비밀번호
            </label>
            <div className="amgi-sync-pw-wrap">
              <input
                id={passwordId}
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
    : isMediaRunning
      ? 'amgi-sync-pill amgi-sync-pill--media'
      : syncStatus?.needsFullSync
        ? 'amgi-sync-pill amgi-sync-pill--warn'
        : syncStatus?.lastError
          ? 'amgi-sync-pill amgi-sync-pill--error'
          : 'amgi-sync-pill';

  const pillLabel = isRunning
    ? '카드 동기화 중'
    : isMediaRunning
      ? '미디어 동기화 중'
      : syncStatus?.needsFullSync
        ? '선택 필요'
        : syncStatus?.lastError
          ? '확인 필요'
          : '연결됨';

  const mediaCheckedCount = extractCount(mediaSyncProgress?.checked ?? syncStatus?.mediaChecked);
  const mediaAddedCount = extractCount(mediaSyncProgress?.added ?? syncStatus?.mediaAdded);
  const mediaRemovedCount = extractCount(mediaSyncProgress?.removed ?? syncStatus?.mediaRemoved);

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
          {syncStatus?.mediaLastSync && (
            <div className="amgi-sync-last-sub">
              미디어 확인: {formatSyncTime(syncStatus.mediaLastSync)}
            </div>
          )}
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
              {!isEink && <IconSync size={15} className="amgi-spin" />}
              <span>카드 동기화 중</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {compact && onSuccess && (
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                  onClick={onSuccess}
                >
                  백그라운드로
                </button>
              )}
              <button
                type="button"
                className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                onClick={() => void handleAbort()}
                disabled={aborting}
              >
                {aborting ? '중단 중...' : '중단'}
              </button>
            </div>
          </div>
          <div className="amgi-sync-progress-text">
            {formatSyncProgressText(syncStatus, syncProgress, mediaSyncProgress)}
          </div>
        </div>
      )}

      {isMediaRunning && (
        <div className="amgi-sync-banner amgi-sync-banner--media" role="status">
          <div className="amgi-sync-progress-head">
            <span className="amgi-sync-progress-title">
              {!isEink && <IconSync size={15} className="amgi-spin" />}
              <span>미디어 백그라운드 동기화</span>
            </span>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              onClick={() => void handleAbortMedia()}
              disabled={mediaAborting}
            >
              {mediaAborting ? '중단 중...' : '중단'}
            </button>
          </div>
          <div className="amgi-sync-media-counters">
            <div className="amgi-sync-media-stat">
              <span className="amgi-sync-media-stat-label">확인</span>
              <span className="amgi-sync-media-stat-val tabular">
                {mediaCheckedCount !== null ? mediaCheckedCount.toLocaleString('ko-KR') : '—'}
              </span>
            </div>
            <div className="amgi-sync-media-stat">
              <span className="amgi-sync-media-stat-label">추가</span>
              <span className="amgi-sync-media-stat-val tabular">
                {mediaAddedCount !== null ? mediaAddedCount.toLocaleString('ko-KR') : '0'}
              </span>
            </div>
            <div className="amgi-sync-media-stat">
              <span className="amgi-sync-media-stat-label">삭제</span>
              <span className="amgi-sync-media-stat-val tabular">
                {mediaRemovedCount !== null ? mediaRemovedCount.toLocaleString('ko-KR') : '0'}
              </span>
            </div>
          </div>
          <div className="amgi-sync-media-note">
            카드는 바로 학습할 수 있으며, 사진·음성은 뒤에서 조용히 맞춰집니다.
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

      {!isMediaRunning && syncStatus?.mediaError && (
        <div className="amgi-sync-banner amgi-sync-banner--warn" role="alert">
          <div>
            <strong>미디어 동기화 중 문제가 생겼어요</strong>
          </div>
          <div>{syncStatus.mediaError}</div>
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary amgi-btn-sm"
            onClick={() => startMediaSync()}
            disabled={isRunning}
            style={{ alignSelf: 'flex-start' }}
          >
            미디어 다시 시도
          </button>
        </div>
      )}

      <div className="amgi-sync-rows">
        <SettingRow
          label="자동 동기화"
          description="앱을 열 때와 앱을 닫거나 다른 앱으로 전환할 때 자동으로 맞춥니다 (짧은 간격으로 반복되면 건너뜁니다)"
          htmlFor={autoSyncId}
          control={
            <Switch
              id={autoSyncId}
              checked={autoSync}
              onChange={(next) => void setPref('sync.auto', next)}
            />
          }
        />
        <SettingRow
          label="사진·소리 함께 맞추기"
          description="카드 속 이미지와 음성을 백그라운드에서 함께 동기화합니다"
          htmlFor={mediaSyncId}
          control={
            <Switch
              id={mediaSyncId}
              checked={mediaSync}
              onChange={(next) => void setPref('sync.media', next)}
            />
          }
        />
        <SettingRow
          label="미디어 지금 다시 확인"
          description={
            isMediaRunning
              ? formatMediaProgressText(syncStatus, mediaSyncProgress)
              : syncStatus?.mediaLastSync
                ? `마지막 확인: ${formatSyncTime(syncStatus.mediaLastSync)}`
                : '카드 속 사진과 음성을 지금 바로 점검합니다'
          }
          onClick={() => startMediaSync()}
          disabled={isRunning || isMediaRunning}
          control={
            isMediaRunning ? (
              <span className="amgi-sync-row-badge">진행 중</span>
            ) : (
              <IconChevronRight size={18} />
            )
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
