import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import { useApp } from '../../context/AppContext';
import {
  ActionMenu,
  IconEdit,
  IconExternal,
  IconFlag,
  IconMore,
  IconStar,
  IconTrash,
  SheetOrDialog,
  useToast,
} from '../../ui';
import { CardFrame, type CardFrameHandle } from '../shared/CardFrame';

function renderNodesToHtml(
  nodes: anki.RenderCardResponse['questionNodes'] | undefined
): string {
  if (!nodes || nodes.length === 0) return '';
  return nodes
    .map((n) => n.text ?? n.replacement?.currentText ?? '')
    .join('');
}

export interface BrowserPreviewContentProps {
  itemId: number;
  isNotesMode: boolean;
  onMutated: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onCloseSheet?: () => void;
}

export function BrowserPreviewContent({
  itemId,
  isNotesMode,
  onMutated,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onCloseSheet,
}: BrowserPreviewContentProps) {
  const { resolvedTheme, navigate, bumpCollection } = useApp();
  const { showToast } = useToast();
  const frameRef = useRef<CardFrameHandle | null>(null);

  const [side, setSide] = useState<'question' | 'answer' | 'both'>('question');
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<anki.Card | null>(null);
  const [note, setNote] = useState<anki.Note | null>(null);
  const [notetypeName, setNotetypeName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [rendered, setRendered] = useState<anki.RenderCardResponse | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const loadItem = useCallback(async () => {
    setLoading(true);
    try {
      let targetCardId = itemId;
      let loadedCard: anki.Card | null = null;
      let loadedNote: anki.Note | null = null;

      if (isNotesMode) {
        loadedNote = await anki.getNote(itemId);
        const cids = await anki.cardsOfNote(itemId);
        if (cids.length > 0) {
          targetCardId = cids[0];
          loadedCard = await anki.getCard(targetCardId);
        }
      } else {
        loadedCard = await anki.getCard(itemId);
        loadedNote = await anki.getNote(loadedCard.noteId);
      }

      setCard(loadedCard);
      setNote(loadedNote);

      const [decks, nt] = await Promise.all([
        anki.getDeckNames(false, true).catch(() => []),
        loadedNote
          ? anki.getNotetype(loadedNote.notetypeId).catch(() => null)
          : Promise.resolve(null),
      ]);

      setNotetypeName(nt?.name ?? '');
      if (loadedCard) {
        const dId = anki.toNumber(loadedCard.deckId);
        const foundDeck = decks.find((d) => anki.toNumber(d.id) === dId);
        setDeckName(foundDeck?.name ?? '');
        const res = await anki.renderExistingCard(targetCardId, true, false);
        setRendered(res);
      } else {
        setDeckName('');
        setRendered(null);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '카드 미리보기를 불러오지 못했습니다.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [itemId, isNotesMode, showToast]);

  useEffect(() => {
    void loadItem();
  }, [loadItem]);

  useEffect(() => {
    if (!rendered || !frameRef.current) return;
    const qHtml = renderNodesToHtml(rendered.questionNodes);
    const aHtml = renderNodesToHtml(rendered.answerNodes);

    if (side === 'question') {
      frameRef.current.render({
        side: 'question',
        html: qHtml,
        preloadAnswerHtml: aHtml,
        css: rendered.css ?? '',
        theme: resolvedTheme,
        tapToFlip: true,
      });
    } else if (side === 'answer') {
      frameRef.current.render({
        side: 'answer',
        html: aHtml,
        css: rendered.css ?? '',
        theme: resolvedTheme,
        tapToFlip: true,
      });
    } else {
      frameRef.current.render({
        side: 'answer',
        html: `${qHtml}<hr id="answer">${aHtml}`,
        css: rendered.css ?? '',
        theme: resolvedTheme,
        tapToFlip: false,
      });
    }
  }, [rendered, side, resolvedTheme]);

  const cardIdNum = card ? anki.toNumber(card.id) : 0;
  const noteIdNum = note ? anki.toNumber(note.id) : 0;
  const isSuspended = card ? card.queue === -1 : false;
  const isBuried = card ? card.queue === -2 || card.queue === -3 : false;
  const isMarked = note ? (note.tags ?? []).includes('marked') : false;
  const flagNum = card ? card.flags & 7 : 0;

  const handleToggleMark = async () => {
    if (!noteIdNum) return;
    try {
      if (isMarked) {
        await anki.removeNoteTags([noteIdNum], 'marked');
        showToast('별표 표시를 해제했습니다.');
      } else {
        await anki.addNoteTags([noteIdNum], 'marked');
        showToast('별표로 표시했습니다.');
      }
      bumpCollection();
      onMutated();
      void loadItem();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '작업에 실패했습니다.', 'error');
    }
  };

  const handleSetFlag = async (flag: number) => {
    if (!cardIdNum) return;
    try {
      await anki.setFlag([cardIdNum], flag);
      setFlagOpen(false);
      showToast(flag === 0 ? '깃발을 해제했습니다.' : `깃발 ${flag}번을 지정했습니다.`);
      bumpCollection();
      onMutated();
      void loadItem();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '깃발 변경에 실패했습니다.', 'error');
    }
  };

  const handleToggleSuspend = async () => {
    if (!cardIdNum) return;
    try {
      if (isSuspended) {
        await anki.restoreBuriedAndSuspendedCards([cardIdNum]);
        showToast('일시 중지를 해제했습니다.');
      } else {
        await anki.buryOrSuspendCards([cardIdNum], [], anki.BuryOrSuspendMode.SUSPEND);
        showToast('카드를 일시 중지했습니다.');
      }
      bumpCollection();
      onMutated();
      void loadItem();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '작업에 실패했습니다.', 'error');
    }
  };

  const handleToggleBury = async () => {
    if (!cardIdNum) return;
    try {
      if (isBuried) {
        await anki.restoreBuriedAndSuspendedCards([cardIdNum]);
        showToast('숨김을 해제했습니다.');
      } else {
        await anki.buryOrSuspendCards([cardIdNum], [], anki.BuryOrSuspendMode.BURY_USER);
        showToast('카드를 숨겼습니다.');
      }
      bumpCollection();
      onMutated();
      void loadItem();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '작업에 실패했습니다.', 'error');
    }
  };

  const handleDeleteNote = async () => {
    if (!noteIdNum) return;
    try {
      await anki.removeNotes([noteIdNum], []);
      setConfirmDeleteOpen(false);
      onCloseSheet?.();
      showToast('노트를 삭제했습니다.', 'success');
      bumpCollection();
      onMutated();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제하지 못했습니다.', 'error');
    }
  };

  const actionItems = useMemo(
    () => [
      {
        id: 'mark',
        label: isMarked ? '별표 표시 해제' : '별표 표시(★)',
        icon: <IconStar size={18} />,
        onSelect: () => void handleToggleMark(),
      },
      {
        id: 'flag',
        label: '깃발 변경',
        icon: <IconFlag size={18} />,
        onSelect: () => setFlagOpen(true),
      },
      {
        id: 'suspend',
        label: isSuspended ? '일시 중지 해제' : '일시 중지',
        onSelect: () => void handleToggleSuspend(),
      },
      {
        id: 'bury',
        label: isBuried ? '숨김 해제' : '오늘 숨기기',
        onSelect: () => void handleToggleBury(),
      },
      ...(cardIdNum
        ? [
            {
              id: 'info',
              label: '카드 상세 정보 보기',
              icon: <IconExternal size={18} />,
              onSelect: () => {
                onCloseSheet?.();
                navigate(`#/card-info/${cardIdNum}`);
              },
            },
          ]
        : []),
      {
        id: 'delete',
        label: '노트 삭제',
        icon: <IconTrash size={18} />,
        destructive: true,
        onSelect: () => setConfirmDeleteOpen(true),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMarked, isSuspended, isBuried, cardIdNum]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="amgi-preview-toolbar">
        <div className="amgi-preview-side-tabs" role="tablist" aria-label="미리보기 면">
          <button
            type="button"
            role="tab"
            aria-selected={side === 'question'}
            className={`amgi-preview-side-btn ${side === 'question' ? 'active' : ''}`}
            onClick={() => setSide('question')}
          >
            앞면
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={side === 'answer'}
            className={`amgi-preview-side-btn ${side === 'answer' ? 'active' : ''}`}
            onClick={() => setSide('answer')}
          >
            뒷면
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={side === 'both'}
            className={`amgi-preview-side-btn ${side === 'both' ? 'active' : ''}`}
            onClick={() => setSide('both')}
          >
            양면
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {noteIdNum > 0 && (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              onClick={() => {
                onCloseSheet?.();
                navigate(`#/note/${noteIdNum}`);
              }}
            >
              <IconEdit size={16} />
              <span>편집</span>
            </button>
          )}
          <button
            type="button"
            className="amgi-btn amgi-btn-ghost amgi-btn-icon"
            style={{ width: 44, minWidth: 44, height: 44 }}
            aria-label="카드 작업 더 보기"
            onClick={() => setActionsOpen(true)}
          >
            <IconMore size={18} />
          </button>
        </div>
      </div>

      <div className="amgi-preview-frame-box">
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--surface)',
              zIndex: 2,
              fontSize: 13,
              color: 'var(--text-2)',
            }}
          >
            불러오는 중...
          </div>
        )}
        <CardFrame
          ref={frameRef}
          theme={resolvedTheme}
          title="선택한 카드 미리보기"
          onCardTap={() => setSide((s) => (s === 'question' ? 'answer' : 'question'))}
        />
      </div>

      <div className="amgi-preview-meta">
        <div className="amgi-preview-meta-row">
          {flagNum > 0 && (
            <span className={`amgi-flag-badge amgi-flag-${flagNum}`}>{flagNum}</span>
          )}
          {isMarked && <span className="amgi-state-pill marked">★ 표시됨</span>}
          {isSuspended && <span className="amgi-state-pill suspended">일시 중지</span>}
          {isBuried && <span className="amgi-state-pill buried">숨김</span>}
          {deckName && <span>덱: {deckName}</span>}
          {notetypeName && <span>· 유형: {notetypeName}</span>}
        </div>
        {note && note.tags && note.tags.length > 0 && (
          <div className="amgi-preview-meta-row">
            <span>태그:</span>
            {note.tags.map((t) => (
              <span key={t} className="amgi-state-pill">
                {t}
              </span>
            ))}
          </div>
        )}
        {(onPrev || onNext) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              style={{ flex: 1 }}
              disabled={!hasPrev}
              onClick={onPrev}
            >
              이전 카드
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              style={{ flex: 1 }}
              disabled={!hasNext}
              onClick={onNext}
            >
              다음 카드
            </button>
          </div>
        )}
      </div>

      <ActionMenu
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title="카드 작업"
        items={actionItems}
      />

      <SheetOrDialog
        open={flagOpen}
        onClose={() => setFlagOpen(false)}
        title="깃발 선택"
      >
        <div className="amgi-filter-list">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((f) => {
            const labels = ['해제', '빨강', '주황', '초록', '파랑', '분홍', '청록', '보라'];
            return (
              <button
                key={f}
                type="button"
                className={`amgi-filter-option ${flagNum === f ? 'selected' : ''}`}
                onClick={() => void handleSetFlag(f)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {f > 0 ? (
                    <span className={`amgi-flag-badge amgi-flag-${f}`}>{f}</span>
                  ) : (
                    <span className="amgi-flag-dot" style={{ border: '1px solid var(--border-strong)' }} />
                  )}
                  <span>{f === 0 ? '깃발 해제' : `${f} ${labels[f]}`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </SheetOrDialog>

      <SheetOrDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="노트 삭제"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              onClick={() => void handleDeleteNote()}
            >
              삭제
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          선택한 노트를 삭제할까요? 삭제 후 되돌리기로 복구할 수 있습니다.
        </p>
      </SheetOrDialog>
    </div>
  );
}

export interface BrowserPreviewPaneProps {
  activeItemId: number | null;
  isNotesMode: boolean;
  onMutated: () => void;
  onHidePane?: () => void;
}

export function BrowserPreviewPane({
  activeItemId,
  isNotesMode,
  onMutated,
  onHidePane,
}: BrowserPreviewPaneProps) {
  return (
    <aside className="amgi-browser-preview-pane" aria-label="카드 미리보기">
      {activeItemId === null ? (
        <div className="amgi-browser-empty" style={{ flex: 1, justifyContent: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>미리보기</div>
          <div style={{ fontSize: 13 }}>
            왼쪽 목록에서 항목을 선택하면 카드 화면을 바로 확인할 수 있습니다.
          </div>
          {onHidePane && (
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary amgi-btn-sm"
              onClick={onHidePane}
            >
              미리보기 숨기기
            </button>
          )}
        </div>
      ) : (
        <BrowserPreviewContent
          key={`${isNotesMode ? 'n' : 'c'}:${activeItemId}`}
          itemId={activeItemId}
          isNotesMode={isNotesMode}
          onMutated={onMutated}
        />
      )}
    </aside>
  );
}

export function BrowserPreviewSheet({
  open,
  onClose,
  ids,
  activeItemId,
  isNotesMode,
  onSelectId,
  onMutated,
}: {
  open: boolean;
  onClose: () => void;
  ids: number[];
  activeItemId: number | null;
  isNotesMode: boolean;
  onSelectId: (id: number) => void;
  onMutated: () => void;
}) {
  const idx = activeItemId !== null ? ids.indexOf(activeItemId) : -1;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < ids.length - 1;

  return (
    <SheetOrDialog
      open={open && activeItemId !== null}
      onClose={onClose}
      title="카드 미리보기"
      subtitle={
        idx >= 0
          ? `${(idx + 1).toLocaleString()} / ${ids.length.toLocaleString()}`
          : undefined
      }
      maxWidth={680}
    >
      {activeItemId !== null && (
        <div style={{ height: 'min(62dvh, 480px)', display: 'flex', flexDirection: 'column' }}>
          <BrowserPreviewContent
            key={`${isNotesMode ? 'n' : 'c'}:${activeItemId}`}
            itemId={activeItemId}
            isNotesMode={isNotesMode}
            onMutated={onMutated}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={hasPrev ? () => onSelectId(ids[idx - 1]) : undefined}
            onNext={hasNext ? () => onSelectId(ids[idx + 1]) : undefined}
            onCloseSheet={onClose}
          />
        </div>
      )}
    </SheetOrDialog>
  );
}

