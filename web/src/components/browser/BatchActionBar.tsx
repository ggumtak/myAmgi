import { useEffect, useMemo, useRef, useState } from 'react';
import * as anki from '../../anki';
import {
  ActionMenu,
  IconCheck,
  IconClose,
  IconFlag,
  IconFolder,
  IconMore,
  IconSearch,
  IconTrash,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';

export interface BatchActionBarProps {
  selectedIds: Set<number>;
  isNotesMode: boolean;
  onClearSelection: () => void;
  onMutated: () => void;
}

type BatchModal =
  | null
  | 'menu'
  | 'deck'
  | 'tags'
  | 'flag'
  | 'suspend'
  | 'bury'
  | 'forget'
  | 'due'
  | 'reposition'
  | 'findReplace'
  | 'changeNotetype'
  | 'delete';

const FLAG_LIST = [
  { flag: 0, label: '깃발 해제' },
  { flag: 1, label: '1 빨강' },
  { flag: 2, label: '2 주황' },
  { flag: 3, label: '3 초록' },
  { flag: 4, label: '4 파랑' },
  { flag: 5, label: '5 분홍' },
  { flag: 6, label: '6 청록' },
  { flag: 7, label: '7 보라' },
];

async function runPooled<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export function BatchActionBar({
  selectedIds,
  isNotesMode,
  onClearSelection,
  onMutated,
}: BatchActionBarProps) {
  const { showToast } = useToast();

  const [modal, setModal] = useState<BatchModal>(null);
  const [busy, setBusy] = useState(false);

  // Move Deck state
  const [decks, setDecks] = useState<anki.DeckNameId[]>([]);
  const [deckSearch, setDeckSearch] = useState('');

  // Tags state
  const [tagInput, setTagInput] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagOpMode, setTagOpMode] = useState<'add' | 'remove'>('add');

  // Forget defaults
  const [forgetRestorePos, setForgetRestorePos] = useState(true);
  const [forgetResetCounts, setForgetResetCounts] = useState(false);

  // Set due date
  const [dueDays, setDueDays] = useState('0');

  // Reposition new cards (string drafts clamped on blur/submit)
  const [repoStartDraft, setRepoStartDraft] = useState('0');
  const [repoStepDraft, setRepoStepDraft] = useState('1');
  const [repoRandomize, setRepoRandomize] = useState(false);
  const [repoShift, setRepoShift] = useState(true);

  // Find & Replace
  const [frSearch, setFrSearch] = useState('');
  const [frReplace, setFrReplace] = useState('');
  const [frField, setFrField] = useState('');
  const [frFields, setFrFields] = useState<string[]>([]);
  const [frMatchCase, setFrMatchCase] = useState(false);
  const [frRegex, setFrRegex] = useState(false);

  // Change notetype
  const [ntList, setNtList] = useState<anki.NotetypeNameIdUseCount[]>([]);
  const [oldNtId, setOldNtId] = useState<number>(0);
  const [newNtId, setNewNtId] = useState<number>(0);
  const [changeNtInfo, setChangeNtInfo] = useState<anki.ChangeNotetypeInfo | null>(null);
  const [loadingNtInfo, setLoadingNtInfo] = useState(false);
  const [fieldMap, setFieldMap] = useState<number[]>([]);
  const [templateMap, setTemplateMap] = useState<number[]>([]);
  const [resolvedNtNoteIds, setResolvedNtNoteIds] = useState<number[]>([]);
  const changeNtSeqRef = useRef(0);

  // Delete counts (exact note count + all sibling cards belonging to those notes)
  const [deleteCounts, setDeleteCounts] = useState<{ notes: number; cards: number }>({
    notes: 0,
    cards: 0,
  });
  const [deleteCountsLoading, setDeleteCountsLoading] = useState(false);

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);
  const count = selectedArray.length;

  const resolveCardIds = async (): Promise<number[]> => {
    if (!isNotesMode) return selectedArray;
    const perNote = await runPooled(selectedArray, 6, (nid) => anki.cardsOfNote(nid));
    const set = new Set<number>();
    for (const cids of perNote) {
      for (const cid of cids) set.add(cid);
    }
    return Array.from(set);
  };

  const resolveNoteIds = async (): Promise<number[]> => {
    if (isNotesMode) return selectedArray;
    const cards = await runPooled(selectedArray, 6, (cid) => anki.getCard(cid));
    const set = new Set<number>();
    for (const c of cards) {
      const nid = anki.toNumber(c.noteId);
      if (nid) set.add(nid);
    }
    return Array.from(set);
  };

  useEffect(() => {
    let cancelled = false;
    if (modal === 'deck') {
      anki
        .getDeckNames(false, true)
        .then((list) => {
          if (!cancelled) setDecks(list);
        })
        .catch(() => {
          if (!cancelled) setDecks([]);
        });
    } else if (modal === 'tags') {
      anki
        .getAllTags()
        .then((list) => {
          if (!cancelled) setAllTags(list);
        })
        .catch(() => {
          if (!cancelled) setAllTags([]);
        });
    } else if (modal === 'forget') {
      anki
        .scheduleCardsAsNewDefaults(anki.ScheduleCardsAsNewContext.BROWSER)
        .then((def) => {
          if (cancelled) return;
          setForgetRestorePos(Boolean(def.restorePosition));
          setForgetResetCounts(Boolean(def.resetCounts));
        })
        .catch(() => undefined);
    } else if (modal === 'due') {
      anki
        .getConfigString(anki.ConfigKeyString.SET_DUE_BROWSER)
        .then((val) => {
          if (!cancelled && val) setDueDays(val);
        })
        .catch(() => undefined);
    } else if (modal === 'findReplace') {
      resolveNoteIds()
        .then((nids) => anki.fieldNamesForNotes(nids))
        .then((fields) => {
          if (!cancelled) setFrFields(fields);
        })
        .catch(() => {
          if (!cancelled) setFrFields([]);
        });
    } else if (modal === 'delete') {
      setDeleteCountsLoading(true);
      resolveNoteIds()
        .then(async (nids) => {
          const lists = await runPooled(nids, 6, (nid) => anki.cardsOfNote(nid));
          const cardSet = new Set<number>();
          for (const cids of lists) {
            for (const cid of cids) cardSet.add(cid);
          }
          if (!cancelled) {
            setDeleteCounts({ notes: nids.length, cards: cardSet.size });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDeleteCounts({ notes: selectedArray.length, cards: selectedArray.length });
          }
        })
        .finally(() => {
          if (!cancelled) setDeleteCountsLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal]);

  const finishSuccess = (
    message: string,
    action?: { label: string; onClick: () => void | Promise<void> }
  ) => {
    setModal(null);
    onMutated();
    showToast(message, 'success', action);
  };

  const handleMoveDeck = async (deckId: number, deckName: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const cardIds = await resolveCardIds();
      await anki.setDeck(cardIds, deckId);
      finishSuccess(`카드 ${cardIds.length}장을 "${deckName}" 덱으로 이동했습니다.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '덱 이동에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSetFlag = async (flag: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const cardIds = await resolveCardIds();
      await anki.setFlag(cardIds, flag);
      finishSuccess(
        flag === 0
          ? `카드 ${cardIds.length}장의 깃발을 해제했습니다.`
          : `카드 ${cardIds.length}장에 깃발 ${flag}번을 지정했습니다.`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : '깃발 변경에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyTags = async () => {
    const clean = tagInput.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const noteIds = await resolveNoteIds();
      if (tagOpMode === 'add') {
        await anki.addNoteTags(noteIds, clean);
        finishSuccess(`노트 ${noteIds.length}개에 태그를 추가했습니다.`);
      } else {
        await anki.removeNoteTags(noteIds, clean);
        finishSuccess(`노트 ${noteIds.length}개에서 태그를 제거했습니다.`);
      }
      setTagInput('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '태그 변경에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSuspend = async (suspend: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const cardIds = await resolveCardIds();
      if (suspend) {
        await anki.buryOrSuspendCards(cardIds, [], anki.BuryOrSuspendMode.SUSPEND);
        finishSuccess(`카드 ${cardIds.length}장을 일시 중지했습니다.`);
      } else {
        await anki.restoreBuriedAndSuspendedCards(cardIds);
        finishSuccess(`카드 ${cardIds.length}장의 일시 중지를 해제했습니다.`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '상태 변경에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleBury = async (bury: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const cardIds = await resolveCardIds();
      if (bury) {
        await anki.buryOrSuspendCards(cardIds, [], anki.BuryOrSuspendMode.BURY_USER);
        finishSuccess(`카드 ${cardIds.length}장을 숨겼습니다.`);
      } else {
        await anki.restoreBuriedAndSuspendedCards(cardIds);
        finishSuccess(`카드 ${cardIds.length}장의 숨김을 해제했습니다.`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : '숨김 변경에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleForget = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const cardIds = await resolveCardIds();
      await anki.scheduleCardsAsNew({
        cardIds,
        log: true,
        restorePosition: forgetRestorePos,
        resetCounts: forgetResetCounts,
        context: anki.ScheduleCardsAsNewContext.BROWSER,
      });
      finishSuccess(`카드 ${cardIds.length}장을 새 카드로 되돌렸습니다.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '초기화에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSetDueDate = async () => {
    const clean = dueDays.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      const cardIds = await resolveCardIds();
      await anki.setDueDate(cardIds, clean, anki.ConfigKeyString.SET_DUE_BROWSER);
      finishSuccess(`카드 ${cardIds.length}장의 복습 날짜를 지정했습니다.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '복습 날짜를 지정하지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleFindAndReplace = async () => {
    if (!frSearch || busy) return;
    setBusy(true);
    try {
      const nids = await resolveNoteIds();
      const res = await anki.findAndReplace({
        nids,
        search: frSearch,
        replacement: frReplace,
        regex: frRegex,
        matchCase: frMatchCase,
        fieldName: frField,
      });
      finishSuccess(`${res.count ?? nids.length}개 항목에서 내용을 바꾸었습니다.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '찾아 바꾸기에 실패했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChangeNotetype = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const nids = await resolveNoteIds();
      const singleNt = await anki.getSingleNotetypeOfNotes(nids);
      if (!singleNt) {
        showToast(
          '노트 유형 변경은 같은 노트 유형을 선택한 경우에만 사용할 수 있습니다.',
          'error'
        );
        return;
      }
      const list = await anki.getNotetypeNamesAndCounts();
      const candidates = list.filter((item) => anki.toNumber(item.id) !== singleNt);
      const targetId =
        candidates.length > 0 ? anki.toNumber(candidates[0].id) : singleNt;
      const info = await anki.getChangeNotetypeInfo(singleNt, targetId);
      setResolvedNtNoteIds(nids);
      setNtList(list);
      setOldNtId(singleNt);
      setNewNtId(targetId);
      setChangeNtInfo(info);
      setFieldMap(info.input?.newFields ?? []);
      setTemplateMap(info.input?.newTemplates ?? []);
      setModal('changeNotetype');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : '노트 유형 변경은 같은 노트 유형을 선택한 경우에만 사용할 수 있습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSelectTargetNotetype = async (targetId: number) => {
    const seq = ++changeNtSeqRef.current;
    setNewNtId(targetId);
    setLoadingNtInfo(true);
    setChangeNtInfo(null);
    setFieldMap([]);
    setTemplateMap([]);
    try {
      const info = await anki.getChangeNotetypeInfo(oldNtId, targetId);
      if (seq !== changeNtSeqRef.current) return;
      setChangeNtInfo(info);
      setFieldMap(info.input?.newFields ?? []);
      setTemplateMap(info.input?.newTemplates ?? []);
    } catch (err) {
      if (seq !== changeNtSeqRef.current) return;
      showToast(
        err instanceof Error ? err.message : '유형 매핑 정보를 불러오지 못했습니다.',
        'error'
      );
    } finally {
      if (seq === changeNtSeqRef.current) {
        setLoadingNtInfo(false);
      }
    }
  };

  const handleConfirmChangeNotetype = async () => {
    if (!changeNtInfo?.input || busy || loadingNtInfo) return;
    setBusy(true);
    try {
      await anki.changeNotetype({
        noteIds: resolvedNtNoteIds,
        newFields: fieldMap,
        newTemplates: templateMap,
        oldNotetypeId: oldNtId,
        newNotetypeId: newNtId,
        currentSchema: changeNtInfo.input.currentSchema,
        oldNotetypeName: changeNtInfo.oldNotetypeName,
        isCloze: changeNtInfo.input.isCloze,
      });
      finishSuccess(`노트 ${resolvedNtNoteIds.length}개의 노트 유형을 변경했습니다.`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형 변경에 실패했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const nids = await resolveNoteIds();
      const cardLists = await runPooled(nids, 6, (nid) => anki.cardsOfNote(nid)).catch(
        () => [] as number[][]
      );
      const cardSet = new Set<number>();
      for (const cids of cardLists) {
        for (const cid of cids) cardSet.add(cid);
      }
      const res = await anki.removeNotes(nids, []);
      const deletedNotes = res.count || nids.length;
      const deletedCards = cardSet.size > 0 ? cardSet.size : deleteCounts.cards;
      onClearSelection();
      finishSuccess(
        `노트 ${deletedNotes.toLocaleString()}개(카드 ${deletedCards.toLocaleString()}장)를 삭제했습니다.`,
        {
          label: '되돌리기',
          onClick: async () => {
            try {
              await anki.undo();
              onMutated();
              showToast('삭제를 되돌렸습니다.', 'info');
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : '되돌리기에 실패했습니다.',
                'error'
              );
            }
          },
        }
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : '삭제에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const filteredDecks = useMemo(() => {
    const q = deckSearch.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((d) => (d.name ?? '').toLowerCase().includes(q));
  }, [decks, deckSearch]);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return allTags.slice(0, 10);
    return allTags.filter((t) => t.toLowerCase().includes(q)).slice(0, 10);
  }, [allTags, tagInput]);

  if (count === 0) return null;

  return (
    <>
      <div className="amgi-batch-bar" role="region" aria-label="선택 항목 일괄 작업">
        <button
          type="button"
          className="amgi-batch-btn amgi-batch-btn--close"
          aria-label={`선택 해제 (${count}개 선택됨)`}
          onClick={onClearSelection}
        >
          <IconClose size={16} />
          <span className="tabular">{count.toLocaleString()}</span>
        </button>

        <div className="amgi-batch-actions">
          <button
            type="button"
            className="amgi-batch-btn"
            onClick={() => {
              setDeckSearch('');
              setModal('deck');
            }}
          >
            <IconFolder size={16} />
            <span className="amgi-batch-label-short">덱</span>
            <span className="amgi-batch-label-full">덱 이동</span>
          </button>

          <button
            type="button"
            className="amgi-batch-btn"
            onClick={() => setModal('flag')}
          >
            <IconFlag size={16} />
            <span>깃발</span>
          </button>

          <button
            type="button"
            className="amgi-batch-btn amgi-batch-wide-only"
            onClick={() => setModal('suspend')}
          >
            <span>일시 중지</span>
          </button>

          <button
            type="button"
            className="amgi-batch-btn amgi-batch-btn--danger"
            aria-label="선택 항목 삭제"
            onClick={() => setModal('delete')}
          >
            <IconTrash size={16} />
            <span>삭제</span>
          </button>

          <button
            type="button"
            className="amgi-batch-btn amgi-batch-btn--primary"
            onClick={() => setModal('menu')}
          >
            <IconMore size={16} />
            <span>더보기</span>
          </button>
        </div>
      </div>

      {/* Full Batch Action Menu */}
      <ActionMenu
        open={modal === 'menu'}
        onClose={() => setModal(null)}
        title={`일괄 작업 (${count.toLocaleString()}개 선택됨)`}
        items={[
          {
            id: 'deck',
            label: '덱 이동',
            description: '선택한 카드를 다른 덱으로 옮깁니다',
            icon: <IconFolder size={18} />,
            onSelect: () => {
              setDeckSearch('');
              setModal('deck');
            },
          },
          {
            id: 'tags',
            label: '태그 추가 / 제거',
            description: '선택한 노트에 태그를 붙이거나 뗍니다',
            onSelect: () => {
              setTagOpMode('add');
              setTagInput('');
              setModal('tags');
            },
          },
          {
            id: 'flag',
            label: '깃발 변경',
            description: '1~7번 색상 깃발 지정 또는 해제',
            icon: <IconFlag size={18} />,
            onSelect: () => setModal('flag'),
          },
          {
            id: 'suspend',
            label: '일시 중지 / 해제',
            description: '학습 대기열에서 잠시 제외하거나 복원합니다',
            onSelect: () => setModal('suspend'),
          },
          {
            id: 'bury',
            label: '숨기기 / 숨김 해제',
            description: '오늘 학습에서 카드를 숨기거나 다시 표시합니다',
            onSelect: () => setModal('bury'),
          },
          {
            id: 'forget',
            label: '잊기 (새 카드로 되돌리기)',
            description: '복습 기록과 간격을 초기 상태로 돌립니다',
            onSelect: () => setModal('forget'),
          },
          {
            id: 'due',
            label: '복습 날짜 지정',
            description: '다음 복습 예정일을 직접 입력합니다',
            onSelect: () => setModal('due'),
          },
          {
            id: 'reposition',
            label: '새 카드 순서 변경 (위치 재지정)',
            description: '선택한 새 카드의 학습 시작 순서를 바꿉니다',
            onSelect: () => {
              setRepoStartDraft('0');
              setRepoStepDraft('1');
              setRepoRandomize(false);
              setRepoShift(true);
              setModal('reposition');
            },
          },
          {
            id: 'notetype',
            label: '노트 유형 변경',
            description: '같은 노트 유형의 필드·카드를 새 유형으로 바꿉니다',
            onSelect: () => void handleOpenChangeNotetype(),
          },
          {
            id: 'findReplace',
            label: '찾아 바꾸기',
            description: '선택한 노트의 필드 텍스트를 일괄 수정합니다',
            onSelect: () => {
              setFrSearch('');
              setFrReplace('');
              setFrField('');
              setModal('findReplace');
            },
          },
          {
            id: 'delete',
            label: '삭제',
            description: '선택한 노트와 연결된 카드를 삭제합니다',
            icon: <IconTrash size={18} />,
            destructive: true,
            onSelect: () => setModal('delete'),
          },
        ]}
      />

      {/* Move Deck */}
      <SheetOrDialog
        open={modal === 'deck'}
        onClose={() => setModal(null)}
        title="덱 이동"
        subtitle={`선택한 ${count}개 항목 이동`}
        variant="full"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="amgi-browser-search-wrap">
            <span className="amgi-browser-search-icon">
              <IconSearch size={16} />
            </span>
            <input
              type="search"
              className="amgi-browser-search-input"
              placeholder="이동할 덱 찾기..."
              value={deckSearch}
              onChange={(e) => setDeckSearch(e.target.value)}
            />
          </div>
          <div className="amgi-filter-list">
            {filteredDecks.map((d) => {
              const id = anki.toNumber(d.id);
              const name = d.name ?? '';
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  className="amgi-filter-option"
                  onClick={() => void handleMoveDeck(id, name)}
                >
                  <span>{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </SheetOrDialog>

      {/* Flag */}
      <SheetOrDialog
        open={modal === 'flag'}
        onClose={() => setModal(null)}
        title="깃발 변경"
        subtitle={`선택한 ${count}개 항목`}
      >
        <div className="amgi-filter-list">
          {FLAG_LIST.map((item) => (
            <button
              key={item.flag}
              type="button"
              disabled={busy}
              className="amgi-filter-option"
              onClick={() => void handleSetFlag(item.flag)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                {item.flag > 0 ? (
                  <span className={`amgi-flag-badge amgi-flag-${item.flag}`}>
                    {item.flag}
                  </span>
                ) : (
                  <span
                    className="amgi-flag-dot"
                    style={{ border: '1px solid var(--border-strong)' }}
                  />
                )}
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </div>
      </SheetOrDialog>

      {/* Tags Add/Remove */}
      <SheetOrDialog
        open={modal === 'tags'}
        onClose={() => setModal(null)}
        title="태그 추가 / 제거"
        subtitle={`선택한 ${count}개 항목`}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!tagInput.trim() || busy}
              className="amgi-btn amgi-btn-primary"
              onClick={() => void handleApplyTags()}
            >
              {tagOpMode === 'add' ? '태그 추가' : '태그 제거'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`amgi-btn amgi-btn-sm ${
                tagOpMode === 'add' ? 'amgi-btn-primary' : 'amgi-btn-secondary'
              }`}
              style={{ flex: 1 }}
              onClick={() => setTagOpMode('add')}
            >
              태그 추가
            </button>
            <button
              type="button"
              className={`amgi-btn amgi-btn-sm ${
                tagOpMode === 'remove' ? 'amgi-btn-primary' : 'amgi-btn-secondary'
              }`}
              style={{ flex: 1 }}
              onClick={() => setTagOpMode('remove')}
            >
              태그 제거
            </button>
          </div>
          <label className="form-field">
            <span>태그 (띄어쓰기로 여러 개 입력)</span>
            <input
              type="text"
              className="amgi-input"
              placeholder="예: 중요 일본어::단어"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
            />
          </label>
          {tagSuggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tagSuggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="amgi-chip"
                  onClick={() =>
                    setTagInput((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))
                  }
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetOrDialog>

      {/* Suspend / Unsuspend */}
      <SheetOrDialog
        open={modal === 'suspend'}
        onClose={() => setModal(null)}
        title="일시 중지 / 해제"
        subtitle={`선택한 ${count}개 항목`}
      >
        <div className="amgi-filter-list">
          <button
            type="button"
            disabled={busy}
            className="amgi-filter-option"
            onClick={() => void handleSuspend(true)}
          >
            <span>일시 중지하기</span>
          </button>
          <button
            type="button"
            disabled={busy}
            className="amgi-filter-option"
            onClick={() => void handleSuspend(false)}
          >
            <span>일시 중지 해제하기</span>
          </button>
        </div>
      </SheetOrDialog>

      {/* Bury / Unbury */}
      <SheetOrDialog
        open={modal === 'bury'}
        onClose={() => setModal(null)}
        title="숨기기 / 숨김 해제"
        subtitle={`선택한 ${count}개 항목`}
      >
        <div className="amgi-filter-list">
          <button
            type="button"
            disabled={busy}
            className="amgi-filter-option"
            onClick={() => void handleBury(true)}
          >
            <span>오늘 숨기기</span>
          </button>
          <button
            type="button"
            disabled={busy}
            className="amgi-filter-option"
            onClick={() => void handleBury(false)}
          >
            <span>숨김 해제하기</span>
          </button>
        </div>
      </SheetOrDialog>

      {/* Forget */}
      <SheetOrDialog
        open={modal === 'forget'}
        onClose={() => setModal(null)}
        title="잊기 (새 카드로 되돌리기)"
        subtitle={`선택한 ${count}개 항목`}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              className="amgi-btn amgi-btn-danger"
              onClick={() => void handleForget()}
            >
              새 카드로 되돌리기
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="amgi-setting-row" style={{ padding: '8px 0' }}>
            <div className="amgi-setting-text">
              <span className="amgi-setting-label">원래 순서 위치 복원</span>
              <span className="amgi-setting-desc">추가된 순서 번호를 원래대로 돌립니다</span>
            </div>
            <Switch checked={forgetRestorePos} onChange={setForgetRestorePos} />
          </div>
          <div className="amgi-setting-row" style={{ padding: '8px 0' }}>
            <div className="amgi-setting-text">
              <span className="amgi-setting-label">복습·실패 횟수 초기화</span>
              <span className="amgi-setting-desc">카드에 표시되는 누적 횟수를 0으로 초기화합니다</span>
            </div>
            <Switch checked={forgetResetCounts} onChange={setForgetResetCounts} />
          </div>
        </div>
      </SheetOrDialog>

      {/* Set Due Date */}
      <SheetOrDialog
        open={modal === 'due'}
        onClose={() => setModal(null)}
        title="복습 날짜 지정"
        subtitle={`선택한 ${count}개 항목`}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!dueDays.trim() || busy}
              className="amgi-btn amgi-btn-primary"
              onClick={() => void handleSetDueDate()}
            >
              적용
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="form-field">
            <span>며칠 후 복습할까요?</span>
            <input
              type="text"
              className="amgi-input tabular"
              placeholder="예: 0, 3, 1-7, 7!"
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { val: '0', label: '오늘 (0)' },
              { val: '3', label: '3일 후 (3)' },
              { val: '1-7', label: '1~7일 무작위 (1-7)' },
              { val: '7!', label: '간격도 재설정 (7!)' },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                className={`amgi-chip ${dueDays === p.val ? 'active' : ''}`}
                onClick={() => setDueDays(p.val)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </SheetOrDialog>

      {/* Find and Replace */}
      <SheetOrDialog
        open={modal === 'findReplace'}
        onClose={() => setModal(null)}
        title="찾아 바꾸기"
        subtitle={`선택한 ${count}개 항목에서 텍스트를 바꿉니다`}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!frSearch || busy}
              className="amgi-btn amgi-btn-danger"
              onClick={() => void handleFindAndReplace()}
            >
              모두 바꾸기
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="form-field">
            <span>대상 필드</span>
            <select
              className="amgi-select"
              value={frField}
              onChange={(e) => setFrField(e.target.value)}
            >
              <option value="">모든 필드</option>
              {frFields.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>찾을 내용</span>
            <input
              type="text"
              className="amgi-input"
              value={frSearch}
              onChange={(e) => setFrSearch(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>바꿀 내용</span>
            <input
              type="text"
              className="amgi-input"
              value={frReplace}
              onChange={(e) => setFrReplace(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={frMatchCase}
                onChange={(e) => setFrMatchCase(e.target.checked)}
              />
              <span>대소문자 구분</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={frRegex}
                onChange={(e) => setFrRegex(e.target.checked)}
              />
              <span>정규식 사용</span>
            </label>
          </div>
        </div>
      </SheetOrDialog>

      {/* Change Notetype */}
      <SheetOrDialog
        open={modal === 'changeNotetype'}
        onClose={() => setModal(null)}
        title="노트 유형 변경"
        subtitle={`${resolvedNtNoteIds.length}개 노트 변경 (${changeNtInfo?.oldNotetypeName ?? ''})`}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy || loadingNtInfo || !changeNtInfo}
              className="amgi-btn amgi-btn-primary"
              onClick={() => void handleConfirmChangeNotetype()}
            >
              {loadingNtInfo ? '불러오는 중...' : '변경 적용'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="form-field">
            <span>새 노트 유형</span>
            <select
              className="amgi-select"
              value={newNtId}
              onChange={(e) => void handleSelectTargetNotetype(Number(e.target.value))}
            >
              {ntList.map((nt) => {
                const id = anki.toNumber(nt.id);
                return (
                  <option key={id} value={id}>
                    {nt.name}
                  </option>
                );
              })}
            </select>
          </label>

          {changeNtInfo && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700 }}>필드 연결</div>
              {changeNtInfo.oldFieldNames.map((oldName, idx) => (
                <label key={`${oldName}-${idx}`} className="form-field">
                  <span>{oldName} →</span>
                  <select
                    className="amgi-select"
                    value={fieldMap[idx] ?? -1}
                    onChange={(e) => {
                      const next = [...fieldMap];
                      next[idx] = Number(e.target.value);
                      setFieldMap(next);
                    }}
                  >
                    <option value={-1}>(버리기)</option>
                    {changeNtInfo.newFieldNames.map((newName, nIdx) => (
                      <option key={nIdx} value={nIdx}>
                        {newName}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              {changeNtInfo.oldTemplateNames.length > 0 && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                    카드 기록 연결
                  </div>
                  {changeNtInfo.oldTemplateNames.map((oldT, idx) => (
                    <label key={`${oldT}-${idx}`} className="form-field">
                      <span>{oldT} →</span>
                      <select
                        className="amgi-select"
                        value={templateMap[idx] ?? -1}
                        onChange={(e) => {
                          const next = [...templateMap];
                          next[idx] = Number(e.target.value);
                          setTemplateMap(next);
                        }}
                      >
                        <option value={-1}>(카드 삭제)</option>
                        {changeNtInfo.newTemplateNames.map((newT, nIdx) => (
                          <option key={nIdx} value={nIdx}>
                            {newT}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </SheetOrDialog>

      {/* Delete Confirm */}
      <SheetOrDialog
        open={modal === 'delete'}
        onClose={() => {
          if (!busy) setModal(null);
        }}
        title="선택 항목 삭제"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy || deleteCountsLoading}
              className="amgi-btn amgi-btn-danger"
              onClick={() => void handleDelete()}
            >
              {busy ? '삭제 중...' : '삭제'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          {deleteCountsLoading ? (
            '삭제할 노트와 카드 수를 계산하는 중...'
          ) : (
            <>
              노트 <strong className="tabular">{deleteCounts.notes.toLocaleString()}개</strong>
              (연결된 카드{' '}
              <strong className="tabular">{deleteCounts.cards.toLocaleString()}장</strong>)를
              삭제합니다. 삭제 직후 알림의 되돌리기로 복구할 수 있습니다.
            </>
          )}
        </p>
      </SheetOrDialog>
      {/* Reposition New Cards Modal */}
      <SheetOrDialog
        open={modal === 'reposition'}
        onClose={() => {
          if (!busy) setModal(null);
        }}
        title="새 카드 순서 변경"
        subtitle={`선택한 ${count.toLocaleString()}개 항목 중 새 카드 순서를 재지정합니다`}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              disabled={busy}
              onClick={async () => {
                const parsedStart = Math.max(0, Math.floor(Number(repoStartDraft) || 0));
                const parsedStep = Math.max(1, Math.floor(Number(repoStepDraft) || 1));
                setRepoStartDraft(String(parsedStart));
                setRepoStepDraft(String(parsedStep));
                setBusy(true);
                try {
                  const cids = await resolveCardIds();
                  await anki.repositionNewCards({
                    cardIds: cids,
                    startingFrom: parsedStart,
                    stepSize: parsedStep,
                    randomize: repoRandomize,
                    shiftExisting: repoShift,
                  });
                  finishSuccess(`새 카드 ${cids.length.toLocaleString()}장의 순서를 변경했습니다.`);
                } catch (err) {
                  showToast(
                    err instanceof Error ? err.message : '순서를 변경하지 못했습니다.',
                    'error'
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? '적용 중...' : '적용'}
            </button>
          </>
        }
      >
        <div className="amgi-modal-form">
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="batch-repo-start">
              시작 위치 번호
            </label>
            <input
              id="batch-repo-start"
              type="number"
              inputMode="numeric"
              min={0}
              className="amgi-input tabular"
              value={repoStartDraft}
              onChange={(e) => setRepoStartDraft(e.target.value)}
              onBlur={() => {
                const clamped = Math.max(0, Math.floor(Number(repoStartDraft) || 0));
                setRepoStartDraft(String(clamped));
              }}
            />
          </div>
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="batch-repo-step">
              간격
            </label>
            <input
              id="batch-repo-step"
              type="number"
              inputMode="numeric"
              min={1}
              className="amgi-input tabular"
              value={repoStepDraft}
              onChange={(e) => setRepoStepDraft(e.target.value)}
              onBlur={() => {
                const clamped = Math.max(1, Math.floor(Number(repoStepDraft) || 1));
                setRepoStepDraft(String(clamped));
              }}
            />
          </div>
          <div className="amgi-switch-row">
            <div>
              <div className="amgi-field-label">순서 무작위 섞기</div>
              <div className="amgi-field-hint">선택한 새 카드들을 무작위 순서로 배치합니다</div>
            </div>
            <Switch
              checked={repoRandomize}
              onChange={setRepoRandomize}
              aria-label="순서 무작위 섞기"
            />
          </div>
          <div className="amgi-switch-row">
            <div>
              <div className="amgi-field-label">기존 카드 뒤로 밀기</div>
              <div className="amgi-field-hint">겹치는 번호가 있으면 기존 새 카드를 뒤로 이동합니다</div>
            </div>
            <Switch
              checked={repoShift}
              onChange={setRepoShift}
              aria-label="기존 카드 뒤로 밀기"
            />
          </div>
        </div>
      </SheetOrDialog>
    </>
  );
}

export { IconCheck };
