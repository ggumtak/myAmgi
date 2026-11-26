// Reviewer (`#/study/:id`). UI around the controller in reviewer.ts: top bar
// with counts and actions, the card frame, the answer bar, dialogs.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { hostInfoStore, onHostEvent, usePrefs } from '../../host';
import { goBack, hasOverlay } from '../../lib/back';
import { useCollectionChanges, useOnFocus } from '../../lib/hooks';
import { navigate } from '../../lib/router';
import type { Theme } from '../../lib/theme';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialogs';
import { IconAlert, IconBack, IconMore } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { Menu, type MenuAnchor, type MenuItem } from '../../ui/Menu';
import { OfficialPage } from '../../ui/OfficialPage';
import { LoadingState } from '../../ui/Spinner';
import { ErrorState } from '../../ui/States';
import { AnswerBar } from './AnswerBar';
import { ForgetDialog, ScriptErrorSheet, SetDueDialog, TimeboxDialog } from './StudyDialogs';
import { FRAME_URL } from './frameBridge';
import { actionForKey, type RemoteAction } from './keymap';
import { Reviewer, type ReviewerView } from './reviewer';
import { formatTimer, readStudyPrefs, type StudyPrefs } from './studyLogic';
import { setReviewerUiState } from './uiState';
import './Study.css';

export const FLAG_NAMES = ['', '빨강', '주황', '초록', '파랑', '분홍', '청록', '보라'];

function useAppTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      const obs = new MutationObserver(cb);
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      return () => obs.disconnect();
    },
    () => (document.documentElement.dataset.theme as Theme) || 'light',
    () => 'light' as Theme,
  );
}

type Dialog = null | 'setDue' | 'forget' | 'delete' | 'errors';

export function StudyScreen({ deckId }: { deckId: number }) {
  const [rawPrefs] = usePrefs();
  const info = hostInfoStore.get();
  const theme = useAppTheme();
  const prefs = useMemo(() => readStudyPrefs(rawPrefs, !!info?.eink), [rawPrefs, info?.eink]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState<{ kind: 'more' | 'flag'; anchor: MenuAnchor } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const latest = useRef({ prefs, theme, platform: info?.platform ?? 'desktop' });
  latest.current = { prefs, theme, platform: info?.platform ?? 'desktop' };
  const [reviewer, setReviewer] = useState<Reviewer | null>(null);

  // One controller per deck and mount (created in an effect so StrictMode's double mount stays clean).
  useEffect(() => {
    const r = new Reviewer(deckId, latest.current, {
      navigate: (p) => navigate(p),
      confirmDelete: () => setDialog('delete'),
      openMenu: () => moreRef.current && setMenu({ kind: 'more', anchor: moreRef.current.getBoundingClientRect() }),
      openSetDue: () => setDialog('setDue'),
      openForget: () => setDialog('forget'),
    });
    setReviewer(r);
    void r.start();
    setReviewerUiState(true);
    return () => {
      setReviewerUiState(false);
      r.dispose();
    };
  }, [deckId]);

  if (!reviewer) return <div className="study" data-testid="study" data-phase="loading" />;
  return (
    <StudySession
      reviewer={reviewer}
      prefs={prefs}
      theme={theme}
      platform={info?.platform ?? 'desktop'}
      dialog={dialog}
      setDialog={setDialog}
      menu={menu}
      setMenu={setMenu}
      moreRef={moreRef}
    />
  );
}

function StudySession({
  reviewer,
  prefs,
  theme,
  platform,
  dialog,
  setDialog,
  menu,
  setMenu,
  moreRef,
}: {
  reviewer: Reviewer;
  prefs: StudyPrefs;
  theme: Theme;
  platform: string;
  dialog: Dialog;
  setDialog: (d: Dialog) => void;
  menu: { kind: 'more' | 'flag'; anchor: MenuAnchor } | null;
  setMenu: (m: { kind: 'more' | 'flag'; anchor: MenuAnchor } | null) => void;
  moreRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const view = useSyncExternalStore(reviewer.subscribe, reviewer.getSnapshot, reviewer.getSnapshot);

  useEffect(() => {
    reviewer.setOptions({ prefs, theme, platform });
  }, [reviewer, prefs, theme, platform]);

  // Something changed underneath (another screen, sync, focus back from another app): follow the engine.
  const changes = useCollectionChanges();
  const firstChange = useRef(changes);
  useEffect(() => {
    if (changes !== firstChange.current) void reviewer.refreshIfChanged();
  }, [changes, reviewer]);
  useOnFocus(() => void reviewer.refreshIfChanged());
  useEffect(
    () =>
      onHostEvent('sync-state', (s) => {
        if (s && (s as { running?: boolean }).running === false) void reviewer.refreshIfChanged();
      }),
    [reviewer],
  );

  // Keyboard, volume keys and remotes (parent document and forwarded from the card frame).
  useEffect(() => {
    const handle = (ev: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean; repeat?: boolean }) => {
      if (hasOverlay()) return false;
      const v = reviewer.getSnapshot();
      if (v.phase !== 'question' && v.phase !== 'answer') {
        if ((ev.key === 'u' || (ev.key === 'z' && (ev.ctrlKey || ev.metaKey))) && v.undoLabel) {
          void reviewer.undo();
          return true;
        }
        return false;
      }
      const action = actionForKey(ev, {
        side: v.phase,
        twoButton: prefs.twoButton,
        volumeKeys: prefs.volumeKeys,
        remoteMap: prefs.keyMap as Record<string, RemoteAction> | null,
      });
      if (!action) return false;
      // Holding a key must not answer a run of cards.
      if (ev.repeat && action !== 'scrollUp' && action !== 'scrollDown') return true;
      reviewer.perform(action);
      return true;
    };
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (ev.key === 'Escape') return;
      // Buttons keep Space/Enter for themselves only when they have keyboard focus.
      if ((ev.key === ' ' || ev.key === 'Enter') && t && t.tagName === 'BUTTON' && t.matches(':focus-visible')) return;
      if (handle(ev)) ev.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    const off = reviewer.frame.on((ev) => {
      if (ev.type === 'amgi:key') handle(ev);
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      off();
    };
  }, [reviewer, prefs]);

  const flagItems: MenuItem[] = FLAG_NAMES.map((name, i) => ({
    label: i === 0 ? `${view.card?.flag === 0 ? '✓ ' : ''}깃발 없음` : `${view.card?.flag === i ? '✓ ' : ''}${name} (Ctrl+${i})`,
    onSelect: () => void reviewer.setFlag(i === 0 ? view.card?.flag ?? 0 : i),
    testId: `flag-${i}`,
  }));

  const moreItems: MenuItem[] = [
    { label: '노트 편집 (E)', onSelect: () => reviewer.perform('edit'), testId: 'act-edit' },
    { label: view.card?.marked ? '표시 해제 (*)' : '표시하기 (*)', onSelect: () => reviewer.perform('mark'), testId: 'act-mark' },
    { label: '카드 숨기기 (-)', onSelect: () => reviewer.perform('buryCard'), testId: 'act-bury-card' },
    { label: '노트 숨기기 (=)', onSelect: () => reviewer.perform('buryNote'), testId: 'act-bury-note' },
    { label: '카드 일시 중지 (@)', onSelect: () => reviewer.perform('suspendCard'), testId: 'act-suspend-card' },
    { label: '노트 일시 중지 (!)', onSelect: () => reviewer.perform('suspendNote'), testId: 'act-suspend-note' },
    { label: '잊기…', onSelect: () => setDialog('forget'), testId: 'act-forget' },
    { label: '복습 날짜 지정…', onSelect: () => setDialog('setDue'), testId: 'act-set-due' },
    { label: '카드 정보 (I)', onSelect: () => reviewer.perform('cardInfo'), testId: 'act-card-info' },
    { label: '오디오 다시 재생 (R)', onSelect: () => reviewer.replay(), testId: 'act-replay', disabled: !view.hasAudio },
    { label: view.autoAdvance ? '자동 넘기기 끄기' : '자동 넘기기 켜기', onSelect: () => reviewer.toggleAutoAdvance(), testId: 'act-auto-advance' },
    { label: view.redoLabel ? `다시 실행: ${view.redoLabel}` : '다시 실행', onSelect: () => void reviewer.redo(), testId: 'act-redo', disabled: !view.redoLabel },
    { label: '덱 옵션 (O)', onSelect: () => reviewer.perform('options'), testId: 'act-options' },
    { label: '노트 삭제…', onSelect: () => setDialog('delete'), danger: true, testId: 'act-delete' },
  ];

  const card = view.card;
  return (
    <div className="study" data-testid="study" data-phase={view.phase} data-rendered={view.rendered ?? ''} data-card-id={card?.id ?? ''} data-busy={view.busy || undefined}>
      <TopBar
        view={view}
        actions={
          <>
            <IconButton label={view.undoLabel ? `실행 취소: ${view.undoLabel}` : '실행 취소'} disabled={!view.undoLabel || view.busy} onClick={() => void reviewer.undo()} data-testid="study-undo">
              <IconUndo />
            </IconButton>
            <IconButton
              label="깃발"
              disabled={!card}
              onClick={(e) => setMenu({ kind: 'flag', anchor: e.currentTarget.getBoundingClientRect() })}
              data-testid="study-flag"
            >
              <IconFlag filled={!!card?.flag} />
            </IconButton>
            <IconButton
              ref={moreRef}
              label="더 보기"
              disabled={!card}
              onClick={(e) => setMenu({ kind: 'more', anchor: e.currentTarget.getBoundingClientRect() })}
              data-testid="study-more"
            >
              <IconMore />
            </IconButton>
          </>
        }
      />
      <div className="study-card" data-flag={card?.flag ?? 0}>
        <div className="study-card__flag" aria-hidden={!card?.flag} data-testid="flag-stripe" hidden={!card?.flag}>
          <span className="study-card__flag-num">{card?.flag ? card.flag : ''}</span>
        </div>
        <iframe
          ref={(el) => reviewer.frame.attach(el)}
          className="study-card__frame"
          src={FRAME_URL}
          title="카드"
          data-testid="card-frame"
        />
        {card?.marked && (
          <div className="study-card__mark" data-testid="mark-star" aria-label="표시됨">
            ★
          </div>
        )}
        {view.phase === 'loading' && (
          <div className="study-card__loading">
            <LoadingState />
          </div>
        )}
        {view.scriptErrors.length > 0 && (
          <button type="button" className="study-card__script-error" onClick={() => setDialog('errors')} data-testid="script-error">
            <IconAlert size={16} /> 카드 스크립트 오류
          </button>
        )}
      </div>
      {view.phase === 'error' && (
        <div className="study__overlay study__overlay--error">
          <TopBar view={view} />
          <ErrorState error={view.error} title="학습을 계속하지 못했습니다" onRetry={() => void reviewer.start()} />
        </div>
      )}
      {view.phase === 'congrats' && (
        <div className="study__overlay study__overlay--congrats" data-testid="congrats">
          <OfficialPage title="축하합니다" src="/congrats" />
          <footer className="study-congrats__bar">
            {view.undoLabel && (
              <Button onClick={() => void reviewer.undo()} data-testid="congrats-undo">
                실행 취소
              </Button>
            )}
            <Button variant="primary" onClick={() => navigate('/decks')} data-testid="back-to-decks">
              덱 목록으로
            </Button>
          </footer>
        </div>
      )}
      <AnswerBar view={view} twoButton={prefs.twoButton} onShowAnswer={() => void reviewer.showAnswer()} onAnswer={(r) => void reviewer.answer(r)} />

      <Menu open={menu?.kind === 'flag'} anchor={menu?.anchor ?? null} items={flagItems} onClose={() => setMenu(null)} label="깃발" />
      <Menu open={menu?.kind === 'more'} anchor={menu?.anchor ?? null} items={moreItems} onClose={() => setMenu(null)} label="더 보기" />
      <SetDueDialog open={dialog === 'setDue'} onClose={() => setDialog(null)} onSubmit={(days) => reviewer.setDueDate(days)} />
      <ForgetDialog open={dialog === 'forget'} onClose={() => setDialog(null)} onSubmit={(pos, counts) => reviewer.forget(pos, counts)} />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="노트 삭제"
        message="지금 보고 있는 카드의 노트와 그 노트의 모든 카드를 삭제합니다. 실행 취소로 되돌릴 수 있습니다."
        confirmLabel="삭제"
        danger
        onConfirm={async () => {
          setDialog(null);
          await reviewer.deleteNote();
        }}
        onClose={() => setDialog(null)}
      />
      <ScriptErrorSheet
        open={dialog === 'errors'}
        errors={view.scriptErrors}
        onClose={() => setDialog(null)}
        onClear={() => {
          reviewer.dismissScriptErrors();
          setDialog(null);
        }}
      />
      <TimeboxDialog view={view} onContinue={() => reviewer.continueAfterTimebox()} onFinish={() => navigate('/decks')} />
    </div>
  );
}

function TopBar({ view, actions }: { view: ReviewerView; actions?: React.ReactNode }) {
  const parts = view.deckName.split('::');
  const leaf = parts.pop() || '학습';
  return (
    <header className="study-bar">
      <IconButton label="뒤로" onClick={goBack} data-testid="study-back">
        <IconBack />
      </IconButton>
      <div className="study-bar__titles">
        <h1 className="study-bar__title">{leaf}</h1>
        <div className="study-bar__sub">
          {view.showRemaining && view.card && <Counts view={view} />}
          {view.timer && <Timer timer={view.timer} />}
        </div>
      </div>
      {actions && <div className="study-bar__actions">{actions}</div>}
    </header>
  );
}

function Counts({ view }: { view: ReviewerView }) {
  const names = ['새', '학습', '복습'];
  const kinds = ['new', 'learn', 'review'];
  return (
    <span className="study-counts" data-testid="study-counts" aria-label={`남은 카드: 새 ${view.counts[0]}, 학습 ${view.counts[1]}, 복습 ${view.counts[2]}`}>
      {view.counts.map((n, i) => (
        <span key={kinds[i]} className={`study-counts__item study-counts__item--${kinds[i]} ${view.activeIdx === i ? 'is-active' : ''}`} data-count={kinds[i]}>
          <span className="study-counts__label">{names[i]}</span>
          <span className="study-counts__num num">{n}</span>
        </span>
      ))}
    </span>
  );
}

function Timer({ timer }: { timer: NonNullable<ReviewerView['timer']> }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (timer.stoppedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timer.stoppedAt]);
  const elapsed = (timer.stoppedAt ?? now) - timer.startedAt;
  const over = timer.capMs > 0 && elapsed >= timer.capMs;
  return (
    <span className={`study-timer num ${over ? 'is-over' : ''}`} data-testid="study-timer">
      {formatTimer(over ? timer.capMs : elapsed)}
    </span>
  );
}

const IconUndo = () => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </svg>
);

const IconFlag = ({ filled }: { filled: boolean }) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
);
