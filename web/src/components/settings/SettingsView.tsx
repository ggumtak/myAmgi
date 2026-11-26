import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import * as anki from '../../anki';
import { toNumber } from '../../anki';
import { useApp, type PrefTheme } from '../../context/AppContext';
import {
  host,
  HostApiError,
  type BackupEntry,
  type CollectionStatus,
  type UpdateStatusResponse,
} from '../../host';
import {
  ActionMenu,
  ErrorState,
  IconCheck,
  IconChevronRight,
  IconRefresh,
  SectionCard,
  SettingRow,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import { formatSyncTime, SyncCard } from '../sync/SyncCard';
import './settings.css';

const FONT_SCALES = [0.9, 1.0, 1.15, 1.3] as const;

const LINE_HEIGHT_OPTIONS = [
  { value: 1.4, label: '좁게 (1.4)' },
  { value: 1.65, label: '보통 (1.65)' },
  { value: 1.9, label: '넓게 (1.9)' },
] as const;

const THEME_OPTIONS: Array<{ value: PrefTheme; label: string; desc: string }> = [
  { value: 'auto', label: '자동 (기기 설정)', desc: '기기의 밝음/어두움 설정을 따라갑니다' },
  { value: 'light', label: '밝은 화면', desc: '낮 시간에 보기 좋은 깔끔한 흰 배경' },
  { value: 'dark', label: '어두운 화면', desc: '밤에도 눈이 편한 어두운 배경' },
  { value: 'eink', label: '전자책 흑백', desc: '전자잉크 화면에 맞춘 선명한 흑백 대비' },
];

const BACKUP_KEEP_OPTIONS = [
  { value: 10, label: '10개' },
  { value: 20, label: '20개 (권장)' },
  { value: 30, label: '30개' },
  { value: 50, label: '50개' },
] as const;

function formatRolloverLabel(hour: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  if (h === 0) return '자정 (0시)';
  if (h < 6) return `새벽 ${h}시`;
  if (h < 12) return `오전 ${h}시`;
  if (h === 12) return '정오 (12시)';
  return `오후 ${h - 12}시`;
}

function formatBackupDate(ms: number): string {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const timeStr = d.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${year}년 ${month}월 ${day}일 ${timeStr}`;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function closestFontScaleIndex(raw: unknown): number {
  const num = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1.0;
  let bestIdx = 1;
  let bestDiff = Infinity;
  FONT_SCALES.forEach((v, idx) => {
    const diff = Math.abs(v - num);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function getLineHeightLabel(raw: unknown): string {
  const num = typeof raw === 'number' && Number.isFinite(raw) ? raw : 1.65;
  let best: (typeof LINE_HEIGHT_OPTIONS)[number] = LINE_HEIGHT_OPTIONS[1];
  let bestDiff = Infinity;
  for (const opt of LINE_HEIGHT_OPTIONS) {
    const diff = Math.abs(opt.value - num);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt;
    }
  }
  return best.label;
}

function getThemeLabel(theme: PrefTheme): string {
  return THEME_OPTIONS.find((o) => o.value === theme)?.label ?? '자동 (기기 설정)';
}

function getFlavorLabel(flavor: string | undefined, platform: string | undefined): string {
  if (flavor === 'comet') return '코멧 전자책 전용';
  if (flavor === 'pro') return '안드로이드 기본';
  if (platform === 'desktop') return '데스크톱';
  return flavor || '기본';
}

export const SettingsView: React.FC = () => {
  const {
    info,
    prefs,
    setPref,
    prefTheme,
    resolvedTheme,
    syncStatus,
    bumpCollection,
  } = useApp();
  const { showToast } = useToast();

  const isEinkTheme = resolvedTheme === 'eink';

  // Anki Preferences state
  const [ankiPrefs, setAnkiPrefs] = useState<anki.Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorLog, setLoadErrorLog] = useState<string | undefined>(undefined);

  // Backups & Updates metadata
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupKeep, setBackupKeep] = useState<number>(20);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusResponse | null>(null);
  const [updateUnsupported, setUpdateUnsupported] = useState(false);

  // Pickers
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [lineHeightMenuOpen, setLineHeightMenuOpen] = useState(false);
  const [backupKeepMenuOpen, setBackupKeepMenuOpen] = useState(false);
  const [rolloverSheetOpen, setRolloverSheetOpen] = useState(false);
  const [rolloverCustomOpen, setRolloverCustomOpen] = useState(false);

  // Action busy flags & sub-sheets
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupSheetOpen, setBackupSheetOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupEntry | null>(null);
  const [restoring, setRestoring] = useState(false);

  const [checkingDb, setCheckingDb] = useState(false);
  const [dbProblems, setDbProblems] = useState<string[] | null>(null);

  const [mediaSheetOpen, setMediaSheetOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaResult, setMediaResult] = useState<anki.CheckMediaResponse | null>(null);
  const [mediaActionBusy, setMediaActionBusy] = useState(false);

  const [emptySheetOpen, setEmptySheetOpen] = useState(false);
  const [emptyLoading, setEmptyLoading] = useState(false);
  const [emptyReport, setEmptyReport] = useState<anki.EmptyCardsReport | null>(null);
  const [emptyRemoving, setEmptyRemoving] = useState(false);

  const [updateSheetOpen, setUpdateSheetOpen] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateApplying, setUpdateApplying] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const [copyingLog, setCopyingLog] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadErrorLog(undefined);
    try {
      const [loadedAnkiPrefs, backupRes, colRes] = await Promise.all([
        anki.getPreferences(),
        host.backupList().catch(() => ({ keep: 20, backups: [] })),
        host.collectionStatus().catch(() => null),
      ]);
      setAnkiPrefs(loadedAnkiPrefs);
      setBackups(backupRes.backups ?? []);
      setBackupKeep(
        typeof prefs['backup.keep'] === 'number'
          ? (prefs['backup.keep'] as number)
          : backupRes.keep ?? 20
      );
      if (colRes) setCollectionStatus(colRes);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : '설정을 불러오는 중 문제가 발생했습니다.'
      );
      setLoadErrorLog(err instanceof Error ? err.stack || err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [prefs]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!info) return;
    if (info.platform !== 'android') {
      setUpdateUnsupported(true);
      setUpdateStatus({ supported: false, currentVersion: info.appVersion });
      return;
    }

    let cancelled = false;
    host
      .updateStatus()
      .then((upd) => {
        if (cancelled) return;
        setUpdateStatus(upd);
        setUpdateUnsupported(upd?.supported === false);
      })
      .catch((updErr) => {
        if (cancelled) return;
        if (updErr instanceof HostApiError && updErr.status === 501) {
          setUpdateUnsupported(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [info]);

  const refreshBackups = useCallback(async () => {
    try {
      const res = await host.backupList();
      setBackups(res.backups ?? []);
      setBackupKeep(res.keep ?? 20);
    } catch {
      // Ignore background backup list error
    }
  }, []);

  const updateAnkiReviewingPref = async (
    patch: Partial<{ showIntervalsOnButtons: boolean; showRemainingDueCounts: boolean }>
  ) => {
    if (!ankiPrefs) return;
    const nextPrefs: anki.Preferences = {
      ...ankiPrefs,
      reviewing: {
        ...(ankiPrefs.reviewing ?? {}),
        ...patch,
      },
    };
    setAnkiPrefs(nextPrefs);
    try {
      await anki.setPreferences(nextPrefs);
    } catch (err) {
      setAnkiPrefs(ankiPrefs);
      showToast(
        err instanceof Error ? err.message : '설정을 저장하지 못했습니다.',
        'error'
      );
    }
  };

  const updateRolloverHour = async (hour: number) => {
    if (!ankiPrefs) return;
    const clamped = ((Math.round(hour) % 24) + 24) % 24;
    const nextPrefs: anki.Preferences = {
      ...ankiPrefs,
      scheduling: {
        ...(ankiPrefs.scheduling ?? {}),
        rollover: clamped,
      },
    };
    setAnkiPrefs(nextPrefs);
    try {
      await anki.setPreferences(nextPrefs);
      bumpCollection();
      showToast(`하루 시작 시각을 ${formatRolloverLabel(clamped)}로 맞췄습니다.`, 'success');
    } catch (err) {
      setAnkiPrefs(ankiPrefs);
      showToast(
        err instanceof Error ? err.message : '설정을 저장하지 못했습니다.',
        'error'
      );
    }
  };

  // Pref values with defaults matching spec
  const twoButtonMode =
    typeof prefs['study.twoButton'] === 'boolean'
      ? (prefs['study.twoButton'] as boolean)
      : true;
  const tapToFlip = prefs['study.tapToFlip'] === true;
  const volumeKeys =
    typeof prefs['study.volumeKeys'] === 'boolean'
      ? (prefs['study.volumeKeys'] as boolean)
      : Boolean(info?.eink);
  const autoPlayAudio = prefs['study.autoPlayAudio'] !== false;
  const hanjaTap = prefs['study.hanjaTap'] !== false;

  const fontScaleIdx = closestFontScaleIndex(prefs['study.fontScale']);
  const fontScale = FONT_SCALES[fontScaleIdx];
  const fontScalePct = Math.round(fontScale * 100);

  const showIntervals = ankiPrefs?.reviewing?.showIntervalsOnButtons !== false;
  const showRemaining = ankiPrefs?.reviewing?.showRemainingDueCounts !== false;
  const rolloverHour = ankiPrefs?.scheduling?.rollover ?? 4;

  const effectiveBackupKeep =
    typeof prefs['backup.keep'] === 'number' ? (prefs['backup.keep'] as number) : backupKeep;

  // Section 4 actions
  const handleCreateBackup = async () => {
    if (creatingBackup) return;
    setCreatingBackup(true);
    try {
      await host.backupCreate();
      await refreshBackups();
      showToast('백업을 저장했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '백업을 만들지 못했습니다.',
        'error'
      );
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleOpenBackupManager = async () => {
    setBackupSheetOpen(true);
    await refreshBackups();
  };

  const handleConfirmRestore = async () => {
    if (!restoreTarget || restoring) return;
    setRestoring(true);
    try {
      await host.backupRestore(restoreTarget.name);
      setRestoreTarget(null);
      setBackupSheetOpen(false);
      await refreshBackups();
      bumpCollection();
      showToast('선택한 백업으로 복원했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '백업을 복원하지 못했습니다.',
        'error'
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleCheckDatabase = async () => {
    if (checkingDb) return;
    setCheckingDb(true);
    try {
      const problems = await anki.checkDatabase();
      setDbProblems(problems);
      bumpCollection();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '학습 데이터 점검에 실패했습니다.',
        'error'
      );
    } finally {
      setCheckingDb(false);
    }
  };

  const runMediaCheck = async () => {
    setMediaLoading(true);
    try {
      const res = await anki.checkMedia();
      setMediaResult(res);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '사진·음성 점검에 실패했습니다.',
        'error'
      );
      setMediaSheetOpen(false);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleOpenMediaCheck = () => {
    setMediaResult(null);
    setMediaSheetOpen(true);
    void runMediaCheck();
  };

  const handleTrashUnusedMedia = async () => {
    if (!mediaResult?.unused?.length || mediaActionBusy) return;
    setMediaActionBusy(true);
    try {
      await anki.trashMediaFiles(mediaResult.unused);
      showToast('사용하지 않는 파일을 휴지통으로 옮겼습니다.', 'success');
      await runMediaCheck();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '파일을 옮기지 못했습니다.',
        'error'
      );
    } finally {
      setMediaActionBusy(false);
    }
  };

  const handleEmptyMediaTrash = async () => {
    if (mediaActionBusy) return;
    setMediaActionBusy(true);
    try {
      await anki.emptyMediaTrash();
      showToast('휴지통을 비웠습니다.', 'success');
      await runMediaCheck();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '휴지통을 비우지 못했습니다.',
        'error'
      );
    } finally {
      setMediaActionBusy(false);
    }
  };

  const handleRestoreMediaTrash = async () => {
    if (mediaActionBusy) return;
    setMediaActionBusy(true);
    try {
      await anki.restoreMediaTrash();
      showToast('휴지통의 파일을 복구했습니다.', 'success');
      await runMediaCheck();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '파일을 복구하지 못했습니다.',
        'error'
      );
    } finally {
      setMediaActionBusy(false);
    }
  };

  const runEmptyCardsCheck = async () => {
    setEmptyLoading(true);
    try {
      const res = await anki.getEmptyCards();
      setEmptyReport(res);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '빈 카드를 확인하지 못했습니다.',
        'error'
      );
      setEmptySheetOpen(false);
    } finally {
      setEmptyLoading(false);
    }
  };

  const handleOpenEmptyCards = () => {
    setEmptyReport(null);
    setEmptySheetOpen(true);
    void runEmptyCardsCheck();
  };

  const emptyCardIds = (emptyReport?.notes ?? []).flatMap((n) =>
    (n.cardIds ?? []).map((id) => toNumber(id))
  );

  const handleDeleteEmptyCards = async () => {
    if (emptyCardIds.length === 0 || emptyRemoving) return;
    setEmptyRemoving(true);
    try {
      await anki.removeCards(emptyCardIds);
      bumpCollection();
      showToast(`빈 카드 ${emptyCardIds.length}장을 삭제했습니다.`, 'success');
      await runEmptyCardsCheck();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '빈 카드를 삭제하지 못했습니다.',
        'error'
      );
    } finally {
      setEmptyRemoving(false);
    }
  };

  // Section 5 actions
  const handleCheckUpdate = async () => {
    if (updateChecking) return;
    if (info?.platform !== 'android' || updateUnsupported) {
      setUpdateUnsupported(true);
      setUpdateMessage('최신 버전은 GitHub 릴리스에서 확인할 수 있습니다.');
      setUpdateSheetOpen(true);
      return;
    }
    setUpdateChecking(true);
    setUpdateMessage('새 업데이트가 있는지 확인하는 중…');
    setUpdateSheetOpen(true);
    try {
      const res = await host.updateCheck();
      setUpdateStatus(res);
      if (res?.supported === false) {
        setUpdateUnsupported(true);
        setUpdateMessage('최신 버전은 GitHub 릴리스에서 확인할 수 있습니다.');
      } else if (res?.available) {
        setUpdateMessage(`새 버전(${res.version || '최신'})이 준비되었습니다.`);
      } else {
        setUpdateMessage(null);
        setUpdateSheetOpen(false);
        showToast('이미 최신 버전을 사용 중입니다.', 'success');
      }
    } catch (err) {
      if (err instanceof HostApiError && err.status === 501) {
        setUpdateUnsupported(true);
        setUpdateMessage('최신 버전은 GitHub 릴리스에서 확인할 수 있습니다.');
      } else {
        setUpdateMessage(
          err instanceof Error ? err.message : '업데이트를 확인하지 못했습니다.'
        );
      }
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleApplyUpdate = async () => {
    if (updateApplying || info?.platform !== 'android') return;
    setUpdateApplying(true);
    setUpdateMessage('업데이트를 받는 중…');
    try {
      await host.updateApply();
      setUpdateMessage('업데이트를 마쳤습니다. 앱을 다시 불러옵니다.');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      if (err instanceof HostApiError && err.status === 501) {
        setUpdateUnsupported(true);
        setUpdateMessage('최신 버전은 GitHub 릴리스에서 확인할 수 있습니다.');
      } else {
        setUpdateMessage(
          err instanceof Error ? err.message : '업데이트를 적용하지 못했습니다.'
        );
      }
    } finally {
      setUpdateApplying(false);
    }
  };

  const handleCopyErrorLog = async () => {
    if (copyingLog) return;
    setCopyingLog(true);
    try {
      const snap = await host.logGet();
      const text = snap.text || snap.lines?.join('\n') || '기록된 로그가 없습니다.';
      try {
        await host.platformClipboardWrite(text);
      } catch {
        await navigator.clipboard.writeText(text);
      }
      showToast('최근 오류 기록을 클립보드에 복사했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '기록을 복사하지 못했습니다.',
        'error'
      );
    } finally {
      setCopyingLog(false);
    }
  };

  if (loading) {
    return (
      <div className="amgi-settings-page">
        <div className="amgi-settings-loading">
          {!isEinkTheme && <div className="spinner" aria-hidden="true" />}
          <span>설정을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="amgi-settings-page">
        <ErrorState
          title="설정을 불러오지 못했습니다"
          message={loadError}
          errorLog={loadErrorLog}
          onRetry={() => void loadAll()}
        />
      </div>
    );
  }

  const flavorLabel = getFlavorLabel(info?.flavor, info?.platform);
  const appVersionLabel = info?.appVersion || '0.1.0';
  const uiVersionLabel = info?.uiVersion || '내장 버전';

  return (
    <div className="amgi-settings-page">
      {/* 1. 동기화 */}
      <SectionCard title="1. 동기화">
        <SyncCard />
      </SectionCard>

      {/* 2. 학습 설정 */}
      <SectionCard title="2. 학습 설정">
        <SettingRow
          label="2버튼 학습 모드"
          description="켜면 '모름'과 '암기 완료' 2개 버튼만으로 빠르게 학습합니다"
          htmlFor="pref-study-twobutton"
          control={
            <Switch
              id="pref-study-twobutton"
              checked={twoButtonMode}
              onChange={(next) => void setPref('study.twoButton', next)}
            />
          }
        />
        <SettingRow
          label="화면 탭해서 뒤집기"
          description="카드의 빈 곳을 누르면 바로 정답을 확인합니다"
          htmlFor="pref-study-taptoflip"
          control={
            <Switch
              id="pref-study-taptoflip"
              checked={tapToFlip}
              onChange={(next) => void setPref('study.tapToFlip', next)}
            />
          }
        />
        <SettingRow
          label="볼륨 키로 학습"
          description="볼륨 아래로 정답/암기 완료, 위로 모름을 선택합니다"
          htmlFor="pref-study-volumekeys"
          control={
            <Switch
              id="pref-study-volumekeys"
              checked={volumeKeys}
              onChange={(next) => void setPref('study.volumeKeys', next)}
            />
          }
        />
        <SettingRow
          label="소리 자동 재생"
          description="카드를 열 때 녹음된 음성이나 발음을 바로 들려줍니다"
          htmlFor="pref-study-autoplay"
          control={
            <Switch
              id="pref-study-autoplay"
              checked={autoPlayAudio}
              onChange={(next) => void setPref('study.autoPlayAudio', next)}
            />
          }
        />
        <SettingRow
          label="한자 바로보기 연결"
          description="카드 속 한자를 누르면 한자 사전으로 바로 이동합니다"
          htmlFor="pref-study-hanjatap"
          control={
            <Switch
              id="pref-study-hanjatap"
              checked={hanjaTap}
              onChange={(next) => void setPref('study.hanjaTap', next)}
            />
          }
        />
        <SettingRow
          label="버튼 위 복습 간격"
          description="답변 버튼 위에 '1일', '4일' 같은 다음 복습 날짜를 표시합니다"
          htmlFor="pref-anki-intervals"
          control={
            <Switch
              id="pref-anki-intervals"
              checked={showIntervals}
              onChange={(next) =>
                void updateAnkiReviewingPref({ showIntervalsOnButtons: next })
              }
            />
          }
        />
        <SettingRow
          label="남은 카드 수 표시"
          description="학습 화면 위쪽에 남은 새 카드·학습·복습 개수를 보여줍니다"
          htmlFor="pref-anki-remaining"
          control={
            <Switch
              id="pref-anki-remaining"
              checked={showRemaining}
              onChange={(next) =>
                void updateAnkiReviewingPref({ showRemainingDueCounts: next })
              }
            />
          }
        />
        <SettingRow
          label="하루 시작 시각"
          description="다음 날 복습 카드가 새로 열리는 시간입니다 (기본 새벽 4시)"
          onClick={() => {
            setRolloverCustomOpen(false);
            setRolloverSheetOpen(true);
          }}
          control={
            <span className="amgi-setting-value-trigger">
              <span className="amgi-setting-value-text">
                {formatRolloverLabel(rolloverHour)}
              </span>
              <IconChevronRight size={18} />
            </span>
          }
        />
      </SectionCard>

      {/* 3. 화면 및 글자 */}
      <SectionCard title="3. 화면 및 글자">
        <SettingRow
          label="화면 테마"
          description="어두운 밤에는 어두운 화면, 전자책 기기엔 흑백 모드가 편합니다"
          onClick={() => setThemeMenuOpen(true)}
          control={
            <span className="amgi-setting-value-trigger">
              <span className="amgi-setting-value-text">{getThemeLabel(prefTheme)}</span>
              <IconChevronRight size={18} />
            </span>
          }
        />
        <SettingRow
          label="카드 글자 크기"
          description={`학습할 때 카드 본문 글씨 크기를 조절합니다 (현재 ${fontScalePct}%)`}
          control={
            <div className="amgi-scale-stepper">
              <button
                type="button"
                className="amgi-scale-btn"
                aria-label="글자 크기 작게"
                disabled={fontScaleIdx <= 0}
                onClick={() =>
                  void setPref('study.fontScale', FONT_SCALES[fontScaleIdx - 1])
                }
                data-compact="true"
              >
                -
              </button>
              <span className="amgi-scale-val">{fontScalePct}%</span>
              <button
                type="button"
                className="amgi-scale-btn"
                aria-label="글자 크기 크게"
                disabled={fontScaleIdx >= FONT_SCALES.length - 1}
                onClick={() =>
                  void setPref('study.fontScale', FONT_SCALES[fontScaleIdx + 1])
                }
                data-compact="true"
              >
                +
              </button>
            </div>
          }
        />
        <SettingRow
          label="카드 줄 간격"
          description="문장이나 예문이 긴 카드가 눈에 편하게 들어오도록 조절합니다"
          onClick={() => setLineHeightMenuOpen(true)}
          control={
            <span className="amgi-setting-value-trigger">
              <span className="amgi-setting-value-text">
                {getLineHeightLabel(prefs['study.lineHeight'])}
              </span>
              <IconChevronRight size={18} />
            </span>
          }
        />
      </SectionCard>

      {/* 4. 백업 및 데이터 정리 */}
      <SectionCard title="4. 백업 및 데이터 정리">
        <SettingRow
          label="지금 백업 만들기"
          description="현재 모든 카드와 학습 기록을 기기에 안전하게 저장합니다"
          onClick={() => void handleCreateBackup()}
          disabled={creatingBackup}
          control={
            creatingBackup ? (
              <span className="amgi-setting-pill">
                {!isEinkTheme && <IconRefresh size={14} className="amgi-spin" />}
                <span>저장 중</span>
              </span>
            ) : (
              <IconChevronRight size={18} />
            )
          }
        />
        <SettingRow
          label="백업 목록 및 복원"
          description="저장된 날짜별 백업으로 되돌리거나 보관 개수를 정합니다"
          onClick={() => void handleOpenBackupManager()}
          control={
            <span className="amgi-setting-value-trigger">
              <span className="amgi-setting-pill">{backups.length}개</span>
              <IconChevronRight size={18} />
            </span>
          }
        />
        <SettingRow
          label="자동 백업 보관 개수"
          description="오래된 백업을 자동으로 정리하고 최근 개수만 남깁니다"
          onClick={() => setBackupKeepMenuOpen(true)}
          control={
            <span className="amgi-setting-value-trigger">
              <span className="amgi-setting-value-text">{effectiveBackupKeep}개</span>
              <IconChevronRight size={18} />
            </span>
          }
        />
        <SettingRow
          label="학습 데이터 점검"
          description="카드 기록에 오류가 없는지 검사하고 불필요한 공간을 줄입니다"
          onClick={() => void handleCheckDatabase()}
          disabled={checkingDb}
          control={
            checkingDb ? (
              <span className="amgi-setting-pill">점검 중</span>
            ) : (
              <IconChevronRight size={18} />
            )
          }
        />
        <SettingRow
          label="안 쓰는 사진·음성 정리"
          description="카드에서 지워졌지만 남아 있는 파일이나 빠진 파일을 찾습니다"
          onClick={handleOpenMediaCheck}
          control={<IconChevronRight size={18} />}
        />
        <SettingRow
          label="빈 카드 정리"
          description="내용이 비어 있어 더 이상 공부할 필요 없는 카드를 정리합니다"
          onClick={handleOpenEmptyCards}
          control={<IconChevronRight size={18} />}
        />
      </SectionCard>

      {/* 5. 앱 정보 및 업데이트 */}
      <SectionCard title="5. 앱 정보 및 업데이트">
        <SettingRow
          label="업데이트 확인"
          description={
            info?.platform === 'android'
              ? `현재 버전 ${appVersionLabel} · 새 버전이 있는지 확인하고 바로 적용합니다`
              : `현재 버전 ${appVersionLabel} · 최신 버전은 GitHub 릴리스에서 확인할 수 있습니다`
          }
          onClick={() => void handleCheckUpdate()}
          control={
            <span className="amgi-setting-value-trigger">
              {info?.platform === 'android' && updateStatus?.available && (
                <span className="amgi-setting-pill amgi-setting-pill--accent">새 버전</span>
              )}
              <IconChevronRight size={18} />
            </span>
          }
        />
        <SettingRow
          label="오류 기록 복사"
          description="문제가 생겼을 때 개발자에게 보낼 수 있도록 최근 기록을 복사합니다"
          onClick={() => void handleCopyErrorLog()}
          disabled={copyingLog}
          control={
            <span className="amgi-setting-value-trigger">
              <span className="amgi-setting-value-text">
                {copyingLog ? '복사 중' : '복사'}
              </span>
              <IconChevronRight size={18} />
            </span>
          }
        />
        <SettingRow
          label="기기 및 앱 정보"
          description={`${flavorLabel} · UI ${uiVersionLabel} · Anki 엔진 26.09`}
          onClick={() => setInfoSheetOpen(true)}
          control={<IconChevronRight size={18} />}
        />
      </SectionCard>

      {/* Pickers & Modals */}
      <ActionMenu
        open={themeMenuOpen}
        onClose={() => setThemeMenuOpen(false)}
        title="화면 테마"
        items={THEME_OPTIONS.map((opt) => ({
          id: opt.value,
          label: opt.label,
          description: opt.desc,
          icon: prefTheme === opt.value ? <IconCheck size={18} /> : undefined,
          onSelect: () => {
            void setPref('theme', opt.value);
          },
        }))}
      />

      <ActionMenu
        open={lineHeightMenuOpen}
        onClose={() => setLineHeightMenuOpen(false)}
        title="카드 줄 간격"
        items={LINE_HEIGHT_OPTIONS.map((opt) => ({
          id: String(opt.value),
          label: opt.label,
          icon:
            Math.abs(((prefs['study.lineHeight'] as number) ?? 1.65) - opt.value) < 0.05 ? (
              <IconCheck size={18} />
            ) : undefined,
          onSelect: () => {
            void setPref('study.lineHeight', opt.value);
          },
        }))}
      />

      <ActionMenu
        open={backupKeepMenuOpen}
        onClose={() => setBackupKeepMenuOpen(false)}
        title="자동 백업 보관 개수"
        items={BACKUP_KEEP_OPTIONS.map((opt) => ({
          id: String(opt.value),
          label: opt.label,
          icon: effectiveBackupKeep === opt.value ? <IconCheck size={18} /> : undefined,
          onSelect: () => {
            setBackupKeep(opt.value);
            void setPref('backup.keep', opt.value);
          },
        }))}
      />

      <SheetOrDialog
        open={rolloverSheetOpen}
        onClose={() => setRolloverSheetOpen(false)}
        title="하루 시작 시각"
        subtitle="다음 날 복습 카드가 새로 열리는 시간입니다"
      >
        {!rolloverCustomOpen ? (
          <div className="amgi-action-list">
            {[
              { hour: 4, label: '새벽 4시 (기본)' },
              { hour: 3, label: '새벽 3시' },
              { hour: 5, label: '새벽 5시' },
              { hour: 0, label: '자정 (0시)' },
            ].map((item) => (
              <button
                key={item.hour}
                type="button"
                className="amgi-action-item"
                onClick={() => {
                  setRolloverSheetOpen(false);
                  void updateRolloverHour(item.hour);
                }}
              >
                {rolloverHour === item.hour && <IconCheck size={18} />}
                <span className="amgi-action-item-text">{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              className="amgi-action-item"
              onClick={() => setRolloverCustomOpen(true)}
            >
              <span className="amgi-action-item-text">직접 선택 (0~23시)</span>
              <IconChevronRight size={18} />
            </button>
          </div>
        ) : (
          <div className="amgi-sheet-stack">
            <div className="amgi-rollover-grid">
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  key={h}
                  type="button"
                  className={`amgi-rollover-btn ${rolloverHour === h ? 'active' : ''}`}
                  onClick={() => {
                    setRolloverSheetOpen(false);
                    void updateRolloverHour(h);
                  }}
                >
                  {formatRolloverLabel(h)}
                </button>
              ))}
            </div>
          </div>
        )}
      </SheetOrDialog>

      {/* Backup Manager Sheet */}
      <SheetOrDialog
        open={backupSheetOpen}
        onClose={() => {
          if (!restoring) setBackupSheetOpen(false);
        }}
        title="백업에서 복원하기"
        subtitle="복원하기 전 현재 상태도 자동으로 백업됩니다."
        footer={
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary"
            onClick={() => setBackupSheetOpen(false)}
          >
            닫기
          </button>
        }
      >
        <div className="amgi-sheet-stack">
          {backups.length === 0 ? (
            <p className="amgi-sheet-note">
              아직 저장된 백업이 없습니다. '지금 백업 만들기'를 눌러 첫 백업을 만들어 보세요.
            </p>
          ) : (
            <div className="amgi-backup-list">
              {backups.map((entry) => (
                <div key={entry.name} className="amgi-backup-row">
                  <div className="amgi-backup-meta">
                    <span className="amgi-backup-date">{formatBackupDate(entry.time)}</span>
                    <span className="amgi-backup-size">{formatSize(entry.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                    onClick={() => setRestoreTarget(entry)}
                  >
                    이 시점으로 복원
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetOrDialog>

      <SheetOrDialog
        open={restoreTarget !== null}
        onClose={() => {
          if (!restoring) setRestoreTarget(null);
        }}
        title="이 백업으로 되돌릴까요?"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={restoring}
              onClick={() => setRestoreTarget(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={restoring}
              onClick={() => void handleConfirmRestore()}
            >
              {restoring ? '되돌리는 중...' : '되돌리기'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          지금 기기의 카드 상태는 안전 백업으로 먼저 저장한 뒤, 선택한 시점(
          <strong>{restoreTarget ? formatBackupDate(restoreTarget.time) : ''}</strong>)으로
          바꿉니다.
        </p>
      </SheetOrDialog>

      {/* Database Check Result Dialog */}
      <SheetOrDialog
        open={dbProblems !== null}
        onClose={() => setDbProblems(null)}
        title="데이터 점검 완료"
        footer={
          <button
            type="button"
            className="amgi-btn amgi-btn-primary"
            onClick={() => setDbProblems(null)}
          >
            확인
          </button>
        }
      >
        {dbProblems && dbProblems.length === 0 ? (
          <p className="amgi-prose" style={{ margin: 0 }}>
            모든 카드와 학습 기록이 정상입니다. (불필요한 공간도 함께 정리했어요)
          </p>
        ) : (
          <div className="amgi-sheet-stack">
            <p className="amgi-sheet-note">다음 항목을 확인하고 복구했습니다:</p>
            <ul className="amgi-file-sample-list">
              {(dbProblems ?? []).map((p, idx) => (
                <li key={idx}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </SheetOrDialog>

      {/* Media Check Sheet */}
      <SheetOrDialog
        open={mediaSheetOpen}
        onClose={() => {
          if (!mediaActionBusy) setMediaSheetOpen(false);
        }}
        title="안 쓰는 사진·음성 정리"
        footer={
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary"
            disabled={mediaActionBusy}
            onClick={() => setMediaSheetOpen(false)}
          >
            닫기
          </button>
        }
      >
        {mediaLoading ? (
          <p className="amgi-sheet-note">사진과 음성 파일을 확인하는 중...</p>
        ) : mediaResult ? (
          <div className="amgi-sheet-stack">
            <div className="amgi-stat-pair-grid">
              <div className="amgi-stat-pair-box">
                <span className="amgi-stat-pair-label">카드에 없는 누락 파일</span>
                <span className="amgi-stat-pair-val">
                  {(mediaResult.missing ?? []).length}개
                </span>
              </div>
              <div className="amgi-stat-pair-box">
                <span className="amgi-stat-pair-label">사용하지 않는 파일</span>
                <span className="amgi-stat-pair-val">
                  {(mediaResult.unused ?? []).length}개
                </span>
              </div>
            </div>

            {(mediaResult.missing ?? []).length === 0 &&
              (mediaResult.unused ?? []).length === 0 &&
              !mediaResult.haveTrash && (
                <p className="amgi-sheet-note">
                  정리할 파일이 없습니다. 모든 사진과 음성이 깔끔하게 연결되어 있어요.
                </p>
              )}

            {(mediaResult.unused ?? []).length > 0 && (
              <>
                <ul className="amgi-file-sample-list">
                  {mediaResult.unused.slice(0, 30).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                  {mediaResult.unused.length > 30 && (
                    <li>외 {mediaResult.unused.length - 30}개</li>
                  )}
                </ul>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-danger"
                  disabled={mediaActionBusy}
                  onClick={() => void handleTrashUnusedMedia()}
                >
                  {mediaActionBusy ? '옮기는 중...' : '안 쓰는 파일 휴지통으로 옮기기'}
                </button>
              </>
            )}

            {mediaResult.haveTrash && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-secondary"
                  disabled={mediaActionBusy}
                  onClick={() => void handleEmptyMediaTrash()}
                >
                  휴지통 완전히 비우기
                </button>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-ghost"
                  disabled={mediaActionBusy}
                  onClick={() => void handleRestoreMediaTrash()}
                >
                  휴지통 복구
                </button>
              </div>
            )}
          </div>
        ) : null}
      </SheetOrDialog>

      {/* Empty Cards Sheet */}
      <SheetOrDialog
        open={emptySheetOpen}
        onClose={() => {
          if (!emptyRemoving) setEmptySheetOpen(false);
        }}
        title="빈 카드 정리"
        footer={
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary"
            disabled={emptyRemoving}
            onClick={() => setEmptySheetOpen(false)}
          >
            닫기
          </button>
        }
      >
        {emptyLoading ? (
          <p className="amgi-sheet-note">비어 있는 카드가 있는지 찾는 중...</p>
        ) : emptyReport ? (
          <div className="amgi-sheet-stack">
            {emptyCardIds.length === 0 ? (
              <p className="amgi-prose" style={{ margin: 0 }}>
                비어 있는 카드가 없습니다.
              </p>
            ) : (
              <>
                <p className="amgi-prose" style={{ margin: 0 }}>
                  내용이 없는 카드 <strong>{emptyCardIds.length}장</strong>을 찾았습니다.
                </p>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-danger"
                  disabled={emptyRemoving}
                  onClick={() => void handleDeleteEmptyCards()}
                >
                  {emptyRemoving
                    ? '삭제하는 중...'
                    : `빈 카드 ${emptyCardIds.length}장 삭제하기`}
                </button>
              </>
            )}
          </div>
        ) : null}
      </SheetOrDialog>

      {/* Update Sheet */}
      <SheetOrDialog
        open={updateSheetOpen}
        onClose={() => {
          if (!updateApplying) setUpdateSheetOpen(false);
        }}
        title="업데이트 확인"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={updateApplying}
              onClick={() => setUpdateSheetOpen(false)}
            >
              닫기
            </button>
            {!updateUnsupported && updateStatus?.available && (
              <button
                type="button"
                className="amgi-btn amgi-btn-primary"
                disabled={updateApplying || updateChecking}
                onClick={() => void handleApplyUpdate()}
              >
                {updateApplying ? '업데이트 중...' : '지금 업데이트'}
              </button>
            )}
          </>
        }
      >
        <div className="amgi-sheet-stack">
          <p className="amgi-prose" style={{ margin: 0 }}>
            {updateMessage || `현재 버전 ${appVersionLabel}을 사용 중입니다.`}
          </p>
          {updateStatus?.notes && (
            <pre className="amgi-error-detail">{updateStatus.notes}</pre>
          )}
        </div>
      </SheetOrDialog>

      {/* Device & App Info Sheet */}
      <SheetOrDialog
        open={infoSheetOpen}
        onClose={() => setInfoSheetOpen(false)}
        title="기기 및 앱 정보"
        footer={
          <button
            type="button"
            className="amgi-btn amgi-btn-primary"
            onClick={() => setInfoSheetOpen(false)}
          >
            확인
          </button>
        }
      >
        <div className="amgi-info-kv-list">
          <div className="amgi-info-kv-row">
            <span className="amgi-info-kv-key">앱 버전</span>
            <span className="amgi-info-kv-val">
              {appVersionLabel}
              {info?.build ? ` (${info.build})` : ''}
            </span>
          </div>
          <div className="amgi-info-kv-row">
            <span className="amgi-info-kv-key">버전 구분</span>
            <span className="amgi-info-kv-val">{flavorLabel}</span>
          </div>
          <div className="amgi-info-kv-row">
            <span className="amgi-info-kv-key">화면 버전</span>
            <span className="amgi-info-kv-val">{uiVersionLabel}</span>
          </div>
          <div className="amgi-info-kv-row">
            <span className="amgi-info-kv-key">학습 엔진</span>
            <span className="amgi-info-kv-val">{info?.backendVersion || 'Anki 26.09'}</span>
          </div>
          <div className="amgi-info-kv-row">
            <span className="amgi-info-kv-key">기기</span>
            <span className="amgi-info-kv-val">{info?.device || '—'}</span>
          </div>
          <div className="amgi-info-kv-row">
            <span className="amgi-info-kv-key">마지막 동기화</span>
            <span className="amgi-info-kv-val">{formatSyncTime(syncStatus?.lastSync)}</span>
          </div>
          <div className="amgi-info-kv-row">
            <span className="amgi-info-kv-key">보관 파일 크기</span>
            <span className="amgi-info-kv-val">
              {collectionStatus ? formatSize(collectionStatus.size) : '—'}
            </span>
          </div>
        </div>
      </SheetOrDialog>
    </div>
  );
};
