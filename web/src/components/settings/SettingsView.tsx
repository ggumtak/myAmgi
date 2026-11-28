import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as anki from '../../anki';
import { toNumber } from '../../anki';
import { useApp, type PrefTheme } from '../../context/AppContext';
import {
  host,
  HostApiError,
  uploadHostFile,
  type BackupEntry,
  type CollectionStatus,
  type UpdateStatusResponse,
} from '../../host';
import {
  ActionMenu,
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
  IconSpark,
  SectionCard,
  SettingRow,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import { pushOverlay } from '../../ui/overlayStack';
import { TagManagerSheet } from '../shared/TagManagerSheet';
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

function getFlavorLabel(flavor: string | undefined, platform: string | undefined): string {
  if (flavor === 'comet') return '코멧 전자책 전용';
  if (flavor === 'pro') return '안드로이드 기본';
  if (platform === 'desktop') return '데스크톱';
  return flavor || '기본';
}

function getSettingsAnchorFromHash(rawHash: string): string | null {
  const path = rawHash.replace(/^#/, '').split('?')[0];
  const match = /^\/settings\/(sync|backup|about|advanced)\/?$/.exec(path);
  return match ? match[1] : null;
}

export const SettingsView: React.FC = () => {
  const {
    info,
    prefs,
    setPref,
    prefTheme,
    resolvedTheme,
    syncStatus,
    collectionVersion,
    bumpCollection,
    navigate,
  } = useApp();
  const { showToast } = useToast();

  const isEinkTheme = resolvedTheme === 'eink';

  // Keep latest app prefs in a ref so data loaders never re-run on unrelated pref toggles.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Independent section state: Anki Preferences (never blocks Sync / Backup / Theme / Info)
  const [ankiPrefs, setAnkiPrefs] = useState<anki.Preferences | null>(null);
  const [ankiLoading, setAnkiLoading] = useState(true);
  const [ankiError, setAnkiError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Backups & collection metadata (loaded independently)
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [backupKeep, setBackupKeep] = useState<number>(20);
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusResponse | null>(null);
  const [updateUnsupported, setUpdateUnsupported] = useState(false);

  // Request sequence refs & serialized Anki pref write queue
  const ankiLoadSeqRef = useRef(0);
  const backupLoadSeqRef = useRef(0);
  const ankiWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Pickers
  const [lineHeightMenuOpen, setLineHeightMenuOpen] = useState(false);
  const [backupKeepMenuOpen, setBackupKeepMenuOpen] = useState(false);
  const [rolloverSheetOpen, setRolloverSheetOpen] = useState(false);
  const [rolloverCustomOpen, setRolloverCustomOpen] = useState(false);
  const [learnAheadMenuOpen, setLearnAheadMenuOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

  // .colpkg full replacement import
  const colpkgInputRef = useRef<HTMLInputElement | null>(null);
  const [colpkgPending, setColpkgPending] = useState<{ path: string; name: string } | null>(null);
  const [colpkgBusy, setColpkgBusy] = useState(false);

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
  const [emptyTrashConfirmOpen, setEmptyTrashConfirmOpen] = useState(false);

  const [emptySheetOpen, setEmptySheetOpen] = useState(false);
  const [emptyLoading, setEmptyLoading] = useState(false);
  const [emptyReport, setEmptyReport] = useState<anki.EmptyCardsReport | null>(null);
  const [emptyConfirmOpen, setEmptyConfirmOpen] = useState(false);
  const [emptyRemoving, setEmptyRemoving] = useState(false);

  const [updateSheetOpen, setUpdateSheetOpen] = useState(false);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateApplying, setUpdateApplying] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const [copyingLog, setCopyingLog] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);

  const loadAnkiPrefs = useCallback(async (opts?: { quiet?: boolean }) => {
    const seq = ++ankiLoadSeqRef.current;
    if (!opts?.quiet) {
      setAnkiLoading(true);
    }
    setAnkiError(null);
    try {
      const loaded = await anki.getPreferences();
      if (seq !== ankiLoadSeqRef.current) return;
      setAnkiPrefs(loaded);
    } catch (err) {
      if (seq !== ankiLoadSeqRef.current) return;
      setAnkiError(
        err instanceof Error ? err.message : 'Anki 컬렉션 설정을 불러오지 못했습니다.'
      );
    } finally {
      if (seq === ankiLoadSeqRef.current) {
        setAnkiLoading(false);
      }
    }
  }, []);

  const refreshBackups = useCallback(async () => {
    const seq = ++backupLoadSeqRef.current;
    try {
      const res = await host.backupList();
      if (seq !== backupLoadSeqRef.current) return;
      setBackups(res.backups ?? []);
      const prefKeep = prefsRef.current['backup.keep'];
      setBackupKeep(typeof prefKeep === 'number' ? prefKeep : res.keep ?? 20);
    } catch {
      // Keep previous backup list if background refresh fails
    }
  }, []);

  const refreshCollectionStatus = useCallback(async () => {
    try {
      const colRes = await host.collectionStatus();
      if (colRes) setCollectionStatus(colRes);
    } catch {
      // Non-critical diagnostic metadata
    }
  }, []);

  // Load only on mount and when collectionVersion changes (never on app-pref toggles).
  const hasMountedRef = useRef(false);
  useEffect(() => {
    const quiet = hasMountedRef.current;
    hasMountedRef.current = true;
    void loadAnkiPrefs({ quiet });
    void refreshBackups();
    void refreshCollectionStatus();
  }, [collectionVersion, loadAnkiPrefs, refreshBackups, refreshCollectionStatus]);

  // Scroll to anchored settings section when navigated via #/settings/(sync|backup|about|advanced).
  useEffect(() => {
    const scrollToHashSection = () => {
      const anchor = getSettingsAnchorFromHash(window.location.hash || '');
      if (!anchor) return;
      if (anchor === 'advanced') {
        setAdvancedOpen(true);
      }
      requestAnimationFrame(() => {
        const el = document.getElementById(`settings-${anchor}`);
        el?.scrollIntoView({ behavior: isEinkTheme ? 'auto' : 'smooth', block: 'start' });
      });
    };
    scrollToHashSection();
    window.addEventListener('hashchange', scrollToHashSection);
    return () => window.removeEventListener('hashchange', scrollToHashSection);
  }, [isEinkTheme]);

  // In the custom rollover hour grid, hardware back / Escape returns to the preset list first.
  useEffect(() => {
    if (!rolloverSheetOpen || !rolloverCustomOpen) return;
    return pushOverlay({
      close: () => setRolloverCustomOpen(false),
    });
  }, [rolloverSheetOpen, rolloverCustomOpen]);

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

  // Always fetch fresh Anki preferences and merge the specific patch right before writing
  // so restored or synced settings are never clobbered by stale local state.
  const ankiPendingWritesRef = useRef(0);
  const writeAnkiPrefPatch = useCallback(
    (
      applyPatch: (base: anki.Preferences) => anki.Preferences,
      opts?: { bumpAfter?: boolean; successMsg?: string }
    ) => {
      ankiPendingWritesRef.current += 1;
      // Invalidate any in-flight background loadAnkiPrefs so it cannot overwrite optimistic state.
      ankiLoadSeqRef.current += 1;
      setAnkiPrefs((cur) => (cur ? applyPatch(cur) : cur));

      const task = ankiWriteQueueRef.current.then(async () => {
        try {
          const fresh = await anki.getPreferences();
          const merged = applyPatch(fresh);
          await anki.setPreferences(merged);
          ankiLoadSeqRef.current += 1;
          setAnkiError(null);
          if (ankiPendingWritesRef.current <= 1) {
            setAnkiPrefs(merged);
          }
          if (opts?.bumpAfter) {
            bumpCollection();
          }
          if (opts?.successMsg) {
            showToast(opts.successMsg, 'success');
          }
        } catch (err) {
          // Reload authoritative server prefs rather than restoring a stale closure snapshot
          // that could revert an earlier succeeded toggle in the queue.
          void loadAnkiPrefs({ quiet: true });
          showToast(
            err instanceof Error ? err.message : '설정을 저장하지 못했습니다.',
            'error'
          );
        } finally {
          ankiPendingWritesRef.current = Math.max(0, ankiPendingWritesRef.current - 1);
        }
      });

      ankiWriteQueueRef.current = task.catch(() => undefined);
      return task;
    },
    [bumpCollection, loadAnkiPrefs, showToast]
  );

  const updateAnkiReviewingPref = (
    patch: Partial<{
      showIntervalsOnButtons: boolean;
      showRemainingDueCounts: boolean;
      interruptAudioWhenAnswering: boolean;
    }>
  ) =>
    writeAnkiPrefPatch((base) => ({
      ...base,
      reviewing: {
        ...(base.reviewing ?? {}),
        ...patch,
      },
    }));

  const updateAnkiSchedulingPref = (
    patch: Partial<{
      rollover: number;
      learnAheadSecs: number;
    }>,
    successMsg?: string
  ) =>
    writeAnkiPrefPatch(
      (base) => ({
        ...base,
        scheduling: {
          ...(base.scheduling ?? {}),
          ...patch,
        },
      }),
      { bumpAfter: true, successMsg }
    );

  const updateAnkiEditingPref = (
    patch: Partial<{
      pasteStripsFormatting: boolean;
      addingDefaultsToCurrentDeck: boolean;
    }>
  ) =>
    writeAnkiPrefPatch((base) => ({
      ...base,
      editing: {
        ...(base.editing ?? {}),
        ...patch,
      },
    }));

  const updateRolloverHour = async (hour: number) => {
    const clamped = ((Math.round(hour) % 24) + 24) % 24;
    await updateAnkiSchedulingPref(
      { rollover: clamped },
      `하루 시작 시각을 ${formatRolloverLabel(clamped)}로 맞췄습니다.`
    );
  };

  const handleApplyAnkiDefaults = async () => {
    try {
      await setPref('study.twoButton', false);
      await setPref('study.autoPlayAudio', true);
      showToast('4버튼 학습 모드와 소리 자동 재생을 켰습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '학습 방식을 변경하지 못했습니다.',
        'error'
      );
    }
  };

  const handlePickColpkgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setColpkgBusy(true);
    try {
      const uploaded = await uploadHostFile(file, file.name);
      const res = await host.importFile({ path: uploaded.path, name: file.name });
      if (res.kind === 'colpkg' && res.needsConfirm) {
        setColpkgPending({ path: res.path, name: file.name });
      } else {
        showToast('Anki 전체 백업(.colpkg) 파일을 선택해 주세요.', 'info');
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '파일을 올리지 못했습니다.',
        'error'
      );
    } finally {
      setColpkgBusy(false);
    }
  };

  const handleConfirmColpkgImport = async () => {
    if (!colpkgPending || colpkgBusy) return;
    setColpkgBusy(true);
    try {
      await host.importFile({
        path: colpkgPending.path,
        name: colpkgPending.name,
        replace: true,
      });
      setColpkgPending(null);
      bumpCollection();
      showToast('백업 파일로 전체 컬렉션을 교체했습니다.', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '컬렉션을 교체하지 못했습니다.',
        'error'
      );
    } finally {
      setColpkgBusy(false);
    }
  };

  // Pref values with defaults matching StudyView
  const twoButtonMode =
    typeof prefs['study.twoButton'] === 'boolean'
      ? (prefs['study.twoButton'] as boolean)
      : typeof prefs['study.twoButtonMode'] === 'boolean'
        ? (prefs['study.twoButtonMode'] as boolean)
        : Boolean(info?.eink);
  const leftHandedMode = prefs['study.leftHanded'] === true;
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
  const interruptAudio = Boolean(ankiPrefs?.reviewing?.interruptAudioWhenAnswering);
  const rolloverHour = ankiPrefs?.scheduling?.rollover ?? 4;
  const learnAheadMins = Math.round((ankiPrefs?.scheduling?.learnAheadSecs ?? 1200) / 60);
  const pasteStrips = Boolean(ankiPrefs?.editing?.pasteStripsFormatting);
  const addToCurrentDeck = ankiPrefs?.editing?.addingDefaultsToCurrentDeck !== false;

  const effectiveBackupKeep =
    typeof prefs['backup.keep'] === 'number' ? (prefs['backup.keep'] as number) : backupKeep;

  // Backup & Maintenance actions
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
    setEmptyTrashConfirmOpen(false);
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
      setEmptyTrashConfirmOpen(false);
      showToast('휴지통을 완전히 비웠습니다.', 'success');
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
    setEmptyConfirmOpen(false);
    setEmptySheetOpen(true);
    void runEmptyCardsCheck();
  };

  // Match Anki's default ("keep notes"): when every card of a note is empty, keep its
  // first card so the note itself (and its field contents) is never deleted.
  const emptyCardIds = (emptyReport?.notes ?? []).flatMap((n) => {
    const ids = (n.cardIds ?? []).map((id) => toNumber(id));
    return n.willDeleteNote ? ids.slice(1) : ids;
  });
  const emptyKeptNoteCount = (emptyReport?.notes ?? []).filter(
    (n) => n.willDeleteNote && (n.cardIds?.length ?? 0) > 0
  ).length;

  const handleConfirmDeleteEmptyCards = async () => {
    if (emptyCardIds.length === 0 || emptyRemoving) return;
    setEmptyRemoving(true);
    try {
      await anki.removeCards(emptyCardIds);
      setEmptyConfirmOpen(false);
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

  // Info & Updates actions
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

  const flavorLabel = getFlavorLabel(info?.flavor, info?.platform);
  const appVersionLabel = info?.appVersion || '0.1.0';
  const uiVersionLabel = info?.uiVersion || '내장 버전';
  const backendVersionLabel = info?.backendVersion?.trim() || null;

  return (
    <div className="amgi-settings-page">
      <input
        ref={colpkgInputRef}
        type="file"
        accept=".colpkg"
        style={{ display: 'none' }}
        onChange={(e) => void handlePickColpkgFile(e)}
      />

      {/* 1. 학습 */}
      <div id="settings-study">
        <SectionCard title="학습">
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
            label="왼손잡이 한손 모드"
            description="추가 버튼과 2버튼 학습 배치를 왼손 엄지에 맞게 반대로 배치합니다"
            htmlFor="pref-study-lefthanded"
            control={
              <Switch
                id="pref-study-lefthanded"
                checked={leftHandedMode}
                onChange={(next) => void setPref('study.leftHanded', next)}
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
        </SectionCard>
      </div>

      {/* 2. 화면 */}
      <div id="settings-display">
        <SectionCard title="화면">
          <div className="amgi-theme-picker-wrap">
            <div className="amgi-theme-picker-head">
              <span className="amgi-theme-picker-title">화면 테마</span>
              <span className="amgi-theme-picker-desc">
                {THEME_OPTIONS.find((o) => o.value === prefTheme)?.desc}
              </span>
            </div>
            <div className="amgi-theme-cards" role="radiogroup" aria-label="화면 테마 선택">
              {(
                [
                  { value: 'auto' as PrefTheme, label: '자동' },
                  { value: 'light' as PrefTheme, label: '밝음' },
                  { value: 'dark' as PrefTheme, label: '어둠' },
                  { value: 'eink' as PrefTheme, label: '흑백' },
                ] as const
              ).map((opt) => {
                const selected = prefTheme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`amgi-theme-card ${selected ? 'active' : ''}`}
                    onClick={() => void setPref('theme', opt.value)}
                  >
                    <span
                      className={`amgi-theme-swatch amgi-theme-swatch--${opt.value}`}
                      aria-hidden="true"
                    >
                      <span className="amgi-theme-swatch-bar" />
                      <span className="amgi-theme-swatch-line" />
                    </span>
                    <span className="amgi-theme-card-label">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
      </div>

      {/* 3. 동기화 */}
      <div id="settings-sync">
        <SectionCard title="동기화">
          <SyncCard />
        </SectionCard>
      </div>

      {/* 4. 백업/복원 */}
      <div id="settings-backup">
        <SectionCard title="백업 및 복원">
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
            description="저장된 날짜별 백업으로 되돌립니다"
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
          <button
            type="button"
            className="amgi-setting-row amgi-setting-row-clickable amgi-setting-row--danger"
            disabled={colpkgBusy}
            onClick={() => colpkgInputRef.current?.click()}
          >
            <span className="amgi-setting-text">
              <span className="amgi-setting-label amgi-setting-label--danger">
                {colpkgBusy ? '백업 파일 올리는 중...' : '백업 파일로 전체 교체'}
              </span>
              <span className="amgi-setting-desc">
                Anki 전체 백업 파일(.colpkg)을 불러와 이 기기의 모든 덱·카드·설정을 통째로 교체합니다
              </span>
            </span>
            <span className="amgi-setting-control amgi-setting-control--danger">
              <IconChevronRight size={18} />
            </span>
          </button>
        </SectionCard>
      </div>

      {/* 5. 고급 (Anki) — collapsed by default */}
      <div id="settings-advanced">
        <SectionCard title="고급 (Anki)">
          <button
            type="button"
            className="amgi-setting-row amgi-setting-row-clickable amgi-advanced-toggle"
            aria-expanded={advancedOpen}
            aria-controls="settings-advanced-body"
            onClick={() => setAdvancedOpen((prev) => !prev)}
          >
            <span className="amgi-setting-text">
              <span className="amgi-setting-label">Anki 세부 설정 및 데이터 정리</span>
              <span className="amgi-setting-desc">
                하루 시작 시각, 미리 학습 제한, 데이터 점검·빈 카드 정리
              </span>
            </span>
            <span className="amgi-setting-control">
              {ankiError && !advancedOpen && (
                <span className="amgi-setting-pill amgi-setting-pill--warn">확인 필요</span>
              )}
              <IconChevronDown
                size={18}
                className={`amgi-advanced-chevron ${advancedOpen ? 'is-open' : ''}`}
              />
            </span>
          </button>

          {advancedOpen && (
            <div id="settings-advanced-body" className="amgi-advanced-body">
              {ankiError ? (
                <div className="amgi-anki-inline-error" role="alert">
                  <div className="amgi-anki-inline-error-title">
                    Anki 컬렉션 설정을 불러오지 못했습니다
                  </div>
                  <p className="amgi-anki-inline-error-msg">{ankiError}</p>
                  <p className="amgi-anki-inline-error-hint">
                    위의 동기화나 백업 복원 도구는 계속 사용할 수 있습니다.
                  </p>
                  <button
                    type="button"
                    className="amgi-btn amgi-btn-secondary amgi-btn-sm"
                    onClick={() => void loadAnkiPrefs()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    다시 시도
                  </button>
                </div>
              ) : ankiLoading && !ankiPrefs ? (
                <div className="amgi-anki-inline-loading">
                  {!isEinkTheme && <div className="spinner" aria-hidden="true" />}
                  <span>Anki 설정을 불러오는 중...</span>
                </div>
              ) : (
                <>
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
                    description="다음 날 복습 카드가 새로 열리는 기준 시간입니다 (기본 새벽 4시)"
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
                  <SettingRow
                    label="미리 학습 제한"
                    description="남은 카드가 없을 때 몇 분 뒤 나올 학습 카드까지 미리 당겨 볼지 정합니다"
                    onClick={() => setLearnAheadMenuOpen(true)}
                    control={
                      <span className="amgi-setting-value-trigger">
                        <span className="amgi-setting-value-text">
                          {learnAheadMins <= 0 ? '미리 보지 않음' : `${learnAheadMins}분`}
                        </span>
                        <IconChevronRight size={18} />
                      </span>
                    }
                  />
                  <SettingRow
                    label="답변 시 오디오 즉시 중단"
                    description="정답 버튼을 누르면 재생 중인 카드 음성을 바로 멈춥니다"
                    htmlFor="pref-anki-interrupt-audio"
                    control={
                      <Switch
                        id="pref-anki-interrupt-audio"
                        checked={interruptAudio}
                        onChange={(next) =>
                          void updateAnkiReviewingPref({ interruptAudioWhenAnswering: next })
                        }
                      />
                    }
                  />
                  <SettingRow
                    label="붙여넣기 시 서식 제거"
                    description="노트 편집기에 붙여넣을 때 글꼴·색상 서식을 지우고 순수 글자만 넣습니다"
                    htmlFor="pref-anki-strip-paste"
                    control={
                      <Switch
                        id="pref-anki-strip-paste"
                        checked={pasteStrips}
                        onChange={(next) =>
                          void updateAnkiEditingPref({ pasteStripsFormatting: next })
                        }
                      />
                    }
                  />
                  <SettingRow
                    label="현재 덱으로 새 노트 추가"
                    description="새 노트를 추가할 때 노트 유형 기본 덱 대신 현재 보고 있는 덱을 선택합니다"
                    htmlFor="pref-anki-add-current"
                    control={
                      <Switch
                        id="pref-anki-add-current"
                        checked={addToCurrentDeck}
                        onChange={(next) =>
                          void updateAnkiEditingPref({ addingDefaultsToCurrentDeck: next })
                        }
                      />
                    }
                  />
                  <SettingRow
                    label="새 카드·복습 카드 순서"
                    description="카드 표시 순서는 각 덱의 '학습 옵션'에서 덱별로 설정할 수 있습니다"
                    onClick={() => navigate('#/decks')}
                    control={
                      <span className="amgi-setting-value-trigger">
                        <span className="amgi-setting-value-text">덱으로 이동</span>
                        <IconChevronRight size={18} />
                      </span>
                    }
                  />
                  <SettingRow
                    label="Anki 기본 4버튼으로 전환"
                    description="2버튼 학습 모드를 끄고 소리 자동 재생을 켭니다"
                    onClick={() => void handleApplyAnkiDefaults()}
                    control={
                      <span className="amgi-setting-value-trigger">
                        <IconSpark size={16} />
                        <span className="amgi-setting-value-text">적용</span>
                      </span>
                    }
                  />
                </>
              )}

              <div className="amgi-advanced-subhead">데이터 정리 도구</div>
              <SettingRow
                label="태그 관리"
                description="모든 태그의 이름을 바꾸거나 사용하지 않는 태그를 정리합니다"
                onClick={() => setTagManagerOpen(true)}
                control={<IconChevronRight size={18} />}
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
                description="앞면 내용이 비어 있어 공부할 수 없는 카드를 찾아 정리합니다"
                onClick={handleOpenEmptyCards}
                control={<IconChevronRight size={18} />}
              />
            </div>
          )}
        </SectionCard>
      </div>

      {/* 6. 정보 */}
      <div id="settings-about">
        <SectionCard title="정보">
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
            description={
              backendVersionLabel
                ? `${flavorLabel} · 화면 버전 ${uiVersionLabel} · ${backendVersionLabel}`
                : `${flavorLabel} · 화면 버전 ${uiVersionLabel}`
            }
            onClick={() => setInfoSheetOpen(true)}
            control={<IconChevronRight size={18} />}
          />
        </SectionCard>
      </div>

      {/* Pickers & Modals */}
      <TagManagerSheet open={tagManagerOpen} onClose={() => setTagManagerOpen(false)} />

      <ActionMenu
        open={learnAheadMenuOpen}
        onClose={() => setLearnAheadMenuOpen(false)}
        title="미리 학습 제한"
        subtitle="남은 카드가 없을 때 몇 분 뒤 예정된 학습 카드까지 미리 볼지 정합니다"
        items={[
          { mins: 0, label: '미리 보지 않음 (0분)' },
          { mins: 10, label: '10분' },
          { mins: 20, label: '20분 (Anki 기본값)' },
          { mins: 30, label: '30분' },
          { mins: 60, label: '60분' },
        ].map((item) => ({
          id: String(item.mins),
          label: item.label,
          icon: learnAheadMins === item.mins ? <IconCheck size={18} /> : undefined,
          onSelect: () => {
            void updateAnkiSchedulingPref(
              { learnAheadSecs: item.mins * 60 },
              `미리 학습 제한을 ${item.mins === 0 ? '사용 안 함' : `${item.mins}분`}으로 설정했습니다.`
            );
          },
        }))}
      />

      {/* .colpkg full replacement confirm */}
      <SheetOrDialog
        open={colpkgPending !== null}
        onClose={() => {
          if (!colpkgBusy) setColpkgPending(null);
        }}
        title="백업 파일로 전체 교체할까요?"
        subtitle={colpkgPending?.name}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={colpkgBusy}
              onClick={() => setColpkgPending(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={colpkgBusy}
              onClick={() => void handleConfirmColpkgImport()}
            >
              {colpkgBusy ? '교체하는 중...' : '전체 교체하기'}
            </button>
          </>
        }
      >
        <div className="amgi-sheet-stack">
          <p className="amgi-prose" style={{ margin: 0 }}>
            선택한 <strong>{colpkgPending?.name}</strong> 파일의 덱, 카드, 학습 기록, 설정으로
            이 기기의 현재 내용을 <strong>완전히 교체</strong>합니다. 진행 전 현재 상태는 안전
            백업으로 자동 저장됩니다.
          </p>
          <p className="amgi-sheet-sync-note">
            교체 후 다음 AnkiWeb 동기화 시 어느 쪽 기록을 남길지 묻는 화면이 나타납니다.
            방금 가져온 데이터를 유지하려면 <strong>‘이 기기 내용을 서버로 보내기’</strong>를
            선택해 주세요.
          </p>
        </div>
      </SheetOrDialog>

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
        onClose={() => {
          setRolloverCustomOpen(false);
          setRolloverSheetOpen(false);
        }}
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
            <button
              type="button"
              className="amgi-btn amgi-btn-ghost amgi-btn-sm amgi-rollover-back-btn"
              onClick={() => setRolloverCustomOpen(false)}
            >
              <IconArrowLeft size={16} />
              <span>자주 쓰는 시각으로 돌아가기</span>
            </button>
            <div className="amgi-rollover-grid">
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  key={h}
                  type="button"
                  className={`amgi-rollover-btn ${rolloverHour === h ? 'active' : ''}`}
                  onClick={() => {
                    setRolloverCustomOpen(false);
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
              아직 저장된 백업이 없습니다. ‘지금 백업 만들기’를 눌러 첫 백업을 만들어 보세요.
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
        <div className="amgi-sheet-stack">
          <p className="amgi-prose" style={{ margin: 0 }}>
            지금 기기의 카드 상태는 안전 백업으로 먼저 저장한 뒤, 선택한 시점(
            <strong>{restoreTarget ? formatBackupDate(restoreTarget.time) : ''}</strong>)으로
            되돌립니다.
          </p>
          <p className="amgi-sheet-sync-note">
            복원 후 다음 AnkiWeb 동기화 시 어느 쪽 기록을 남길지 묻는 화면이 나타납니다.
            복원한 데이터를 유지하려면 <strong>‘이 기기 내용을 서버로 보내기’</strong>를
            선택해 주세요.
          </p>
        </div>
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
                  onClick={() => void handleRestoreMediaTrash()}
                >
                  휴지통 파일 복구하기
                </button>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-danger"
                  disabled={mediaActionBusy}
                  onClick={() => setEmptyTrashConfirmOpen(true)}
                >
                  휴지통 완전히 비우기
                </button>
              </div>
            )}
          </div>
        ) : null}
      </SheetOrDialog>

      {/* Media Trash Permanent Delete Confirm */}
      <SheetOrDialog
        open={emptyTrashConfirmOpen}
        onClose={() => {
          if (!mediaActionBusy) setEmptyTrashConfirmOpen(false);
        }}
        title="휴지통을 완전히 비울까요?"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={mediaActionBusy}
              onClick={() => setEmptyTrashConfirmOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={mediaActionBusy}
              onClick={() => void handleEmptyMediaTrash()}
            >
              {mediaActionBusy ? '비우는 중...' : '영구 삭제'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          휴지통에 있는 사진·음성 파일을 영구적으로 삭제합니다. 삭제한 파일은 다시 복구할 수
          없습니다.
        </p>
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
              <>
                <p className="amgi-prose" style={{ margin: 0 }}>
                  삭제할 빈 카드가 없습니다.
                </p>
                {emptyKeptNoteCount > 0 && (
                  <p className="amgi-sheet-note">
                    카드가 모두 비어 있는 노트 {emptyKeptNoteCount.toLocaleString('ko-KR')}개는
                    노트 내용을 지키기 위해 첫 카드 1장을 그대로 유지했습니다.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="amgi-prose" style={{ margin: 0 }}>
                  앞면이 비어 있는 카드{' '}
                  <strong>{emptyCardIds.length.toLocaleString('ko-KR')}장</strong>을 찾았습니다.
                </p>
                {emptyKeptNoteCount > 0 && (
                  <p className="amgi-sheet-note">
                    노트가 통째로 지워지지 않도록 카드가 모두 비어 있는 노트{' '}
                    {emptyKeptNoteCount.toLocaleString('ko-KR')}개는 첫 카드 1장을 남겨 둡니다.
                  </p>
                )}
                <button
                  type="button"
                  className="amgi-btn amgi-btn-danger"
                  disabled={emptyRemoving}
                  onClick={() => setEmptyConfirmOpen(true)}
                >
                  {`빈 카드 ${emptyCardIds.length.toLocaleString('ko-KR')}장 삭제하기`}
                </button>
              </>
            )}
          </div>
        ) : null}
      </SheetOrDialog>

      {/* Empty Cards Delete Confirm */}
      <SheetOrDialog
        open={emptyConfirmOpen}
        onClose={() => {
          if (!emptyRemoving) setEmptyConfirmOpen(false);
        }}
        title={`빈 카드 ${emptyCardIds.length.toLocaleString('ko-KR')}장을 삭제할까요?`}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={emptyRemoving}
              onClick={() => setEmptyConfirmOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={emptyRemoving}
              onClick={() => void handleConfirmDeleteEmptyCards()}
            >
              {emptyRemoving ? '삭제하는 중...' : `${emptyCardIds.length.toLocaleString('ko-KR')}장 삭제`}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          앞면이 비어 있는 카드{' '}
          <strong>{emptyCardIds.length.toLocaleString('ko-KR')}장</strong>을 삭제합니다.
          노트 본문은 지워지지 않으며, 삭제한 카드는 되돌리기(Ctrl+Z) 또는 백업 복원으로만
          복구할 수 있습니다.
        </p>
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
            <span className="amgi-info-kv-val">{backendVersionLabel || '—'}</span>
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
