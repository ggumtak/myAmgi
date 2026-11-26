import React, { useEffect, useRef, useState } from 'react';
import * as anki from '../../anki';
import * as host from '../../host';
import { useApp } from '../../context/AppContext';
import {
  ActionMenu,
  IconEdit,
  IconFilter,
  IconFolder,
  IconUpload,
  SheetOrDialog,
  Switch,
  useToast,
} from '../../ui';
import './decks.css';

export interface AddActionSheetProps {
  open: boolean;
  onClose: () => void;
  defaultDeckId?: number;
}

const FILTERED_ORDER_OPTIONS = [
  { value: anki.FilteredSearchOrder.OLDEST_REVIEWED_FIRST, label: '오래전에 본 카드부터' },
  { value: anki.FilteredSearchOrder.RANDOM, label: '무작위 순서' },
  { value: anki.FilteredSearchOrder.INTERVALS_ASCENDING, label: '복습 간격 짧은 순' },
  { value: anki.FilteredSearchOrder.INTERVALS_DESCENDING, label: '복습 간격 긴 순' },
  { value: anki.FilteredSearchOrder.LAPSES, label: '틀린 횟수 많은 순' },
  { value: anki.FilteredSearchOrder.ADDED, label: '추가한 순서' },
  { value: anki.FilteredSearchOrder.DUE, label: '예정일 순' },
  { value: anki.FilteredSearchOrder.REVERSE_ADDED, label: '최근 추가한 순' },
  { value: anki.FilteredSearchOrder.RELATIVE_OVERDUENESS, label: '가장 시급한 순' },
];

export const AddActionSheet: React.FC<AddActionSheetProps> = ({
  open,
  onClose,
  defaultDeckId,
}) => {
  const { bumpCollection, navigate, registerBackHandler } = useApp();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Create Deck modal state
  const [createDeckOpen, setCreateDeckOpen] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [creatingDeck, setCreatingDeck] = useState(false);

  // Create Filtered Deck modal state
  const [filteredOpen, setFilteredOpen] = useState(false);
  const [filteredName, setFilteredName] = useState('맞춤 학습 덱');
  const [filteredSearch, setFilteredSearch] = useState('is:due');
  const [filteredLimit, setFilteredLimit] = useState(100);
  const [filteredOrder, setFilteredOrder] = useState<number>(
    anki.FilteredSearchOrder.OLDEST_REVIEWED_FIRST
  );
  const [filteredReschedule, setFilteredReschedule] = useState(true);
  const [creatingFiltered, setCreatingFiltered] = useState(false);

  // File import / colpkg confirmation state
  const [uploading, setUploading] = useState(false);
  const [colpkgConfirm, setColpkgConfirm] = useState<{
    path: string;
    name: string;
  } | null>(null);
  const [importingColpkg, setImportingColpkg] = useState(false);

  // Register back handler when any sub-modal or menu is open
  useEffect(() => {
    if (!open && !createDeckOpen && !filteredOpen && !colpkgConfirm) return;
    return registerBackHandler(() => {
      if (colpkgConfirm && !importingColpkg) {
        setColpkgConfirm(null);
        return true;
      }
      if (filteredOpen && !creatingFiltered) {
        setFilteredOpen(false);
        return true;
      }
      if (createDeckOpen && !creatingDeck) {
        setCreateDeckOpen(false);
        return true;
      }
      if (open) {
        onClose();
        return true;
      }
      return false;
    });
  }, [
    open,
    onClose,
    createDeckOpen,
    creatingDeck,
    filteredOpen,
    creatingFiltered,
    colpkgConfirm,
    importingColpkg,
    registerBackHandler,
  ]);

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = deckName.trim();
    if (!trimmed) {
      showToast('덱 이름을 입력해 주세요.', 'error');
      return;
    }
    setCreatingDeck(true);
    try {
      await anki.createSimpleDeck(trimmed);
      setCreateDeckOpen(false);
      setDeckName('');
      bumpCollection();
      showToast(`'${trimmed}' 덱을 만들었습니다.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '덱을 만들지 못했습니다.',
        'error'
      );
    } finally {
      setCreatingDeck(false);
    }
  };

  const openFilteredBuilder = async () => {
    setFilteredOpen(true);
    try {
      const defaults = await anki.getOrCreateFilteredDeck(0);
      const firstTerm = defaults.config?.searchTerms?.[0];
      setFilteredName(defaults.name || '맞춤 학습 덱');
      setFilteredSearch(firstTerm?.search || 'is:due');
      setFilteredLimit(firstTerm?.limit || 100);
      setFilteredOrder(
        firstTerm?.order ?? anki.FilteredSearchOrder.OLDEST_REVIEWED_FIRST
      );
      setFilteredReschedule(defaults.config?.reschedule ?? true);
    } catch {
      // Keep default form values
    }
  };

  const handleCreateFiltered = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = filteredName.trim();
    if (!trimmedName) {
      showToast('필터 덱 이름을 입력해 주세요.', 'error');
      return;
    }
    setCreatingFiltered(true);
    try {
      const base = await anki.getOrCreateFilteredDeck(0);
      const res = await anki.addOrUpdateFilteredDeck({
        id: 0,
        name: trimmedName,
        allowEmpty: base.allowEmpty ?? true,
        config: {
          ...(base.config ?? {}),
          reschedule: filteredReschedule,
          searchTerms: [
            {
              search: filteredSearch.trim(),
              limit: Math.max(1, filteredLimit),
              order: filteredOrder,
            },
          ],
        },
      });
      setFilteredOpen(false);
      bumpCollection();
      showToast(`'${trimmedName}' 필터 덱을 만들었습니다.`, 'success');
      const newDeckId = anki.toNumber(res.id);
      if (newDeckId > 0) {
        navigate(`#/deck/${newDeckId}`);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '필터 덱을 만들지 못했습니다.',
        'error'
      );
    } finally {
      setCreatingFiltered(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await host.uploadHostFile(file, file.name);
      const result = await host.host.importFile({
        path: uploaded.path,
        name: file.name,
      });

      if (result.kind === 'colpkg' && result.needsConfirm) {
        setColpkgConfirm({ path: result.path, name: file.name });
        return;
      }

      if (result.route) {
        navigate(`#${result.route}`);
        return;
      }

      if (result.kind === 'apkg') {
        navigate(`#/import-anki-package/${encodeURIComponent(result.path)}`);
      } else if (result.kind === 'csv') {
        navigate(`#/import-csv/${encodeURIComponent(result.path)}`);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '파일을 가져오지 못했습니다.',
        'error'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmColpkg = async () => {
    if (!colpkgConfirm || importingColpkg) return;
    setImportingColpkg(true);
    try {
      await host.host.importFile({
        path: colpkgConfirm.path,
        name: colpkgConfirm.name,
        replace: true,
      });
      setColpkgConfirm(null);
      bumpCollection();
      showToast('전체 컬렉션을 불러왔습니다.', 'success');
      navigate('#/decks');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '컬렉션 가져오기에 실패했습니다.',
        'error'
      );
    } finally {
      setImportingColpkg(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".apkg,.colpkg,.csv,.tsv,.txt,.zip"
        style={{ display: 'none' }}
        onChange={(e) => void handleFileChange(e)}
      />

      <ActionMenu
        open={open}
        onClose={onClose}
        title="추가하기"
        items={[
          {
            id: 'add-note',
            label: '노트 추가',
            description: '새 단어장 카드 직접 만들기',
            icon: <IconEdit size={20} />,
            onSelect: () => {
              const q = defaultDeckId ? `?deck=${defaultDeckId}` : '';
              navigate(`#/note/new${q}`);
            },
          },
          {
            id: 'create-deck',
            label: '새 덱 만들기',
            description: '상위::하위 형식으로 폴더처럼 구분할 수 있어요',
            icon: <IconFolder size={20} />,
            onSelect: () => {
              setDeckName('');
              setCreateDeckOpen(true);
            },
          },
          {
            id: 'create-filtered',
            label: '맞춤 학습 / 필터 덱 만들기',
            description: '조건에 맞는 카드만 모아 임시 덱 만들기',
            icon: <IconFilter size={20} />,
            onSelect: () => {
              void openFilteredBuilder();
            },
          },
          {
            id: 'import-file',
            label: uploading ? '파일 올리는 중...' : '파일 가져오기 (.apkg · .colpkg · CSV)',
            description: '다른 Anki 덱이나 CSV 단어장을 불러옵니다',
            icon: <IconUpload size={20} />,
            disabled: uploading,
            onSelect: () => {
              fileInputRef.current?.click();
            },
          },
        ]}
      />

      {/* Create New Deck Dialog */}
      <SheetOrDialog
        open={createDeckOpen}
        onClose={() => {
          if (!creatingDeck) setCreateDeckOpen(false);
        }}
        title="새 덱 만들기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={creatingDeck}
              onClick={() => setCreateDeckOpen(false)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-create-deck-form"
              className="amgi-btn amgi-btn-primary"
              disabled={creatingDeck}
            >
              {creatingDeck ? '만드는 중...' : '만들기'}
            </button>
          </>
        }
      >
        <form
          id="amgi-create-deck-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleCreateDeck(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="new-deck-name-input">
              덱 이름
            </label>
            <input
              id="new-deck-name-input"
              type="text"
              className="amgi-input"
              autoFocus
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="예: 일본어::한자 또는 토익 영단어"
            />
            <span className="amgi-field-hint">
              이름 사이에 <code>::</code>를 넣으면 상위 덱 아래에 하위 덱이 만들어집니다.
            </span>
          </div>
        </form>
      </SheetOrDialog>

      {/* Filtered Deck Builder Dialog */}
      <SheetOrDialog
        open={filteredOpen}
        onClose={() => {
          if (!creatingFiltered) setFilteredOpen(false);
        }}
        title="맞춤 학습 / 필터 덱 만들기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={creatingFiltered}
              onClick={() => setFilteredOpen(false)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-create-filtered-form"
              className="amgi-btn amgi-btn-primary"
              disabled={creatingFiltered}
            >
              {creatingFiltered ? '만드는 중...' : '만들기'}
            </button>
          </>
        }
      >
        <form
          id="amgi-create-filtered-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleCreateFiltered(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="add-fd-name">
              필터 덱 이름
            </label>
            <input
              id="add-fd-name"
              type="text"
              className="amgi-input"
              value={filteredName}
              onChange={(e) => setFilteredName(e.target.value)}
            />
          </div>
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="add-fd-search">
              검색 조건
            </label>
            <input
              id="add-fd-search"
              type="text"
              className="amgi-input"
              value={filteredSearch}
              onChange={(e) => setFilteredSearch(e.target.value)}
              placeholder='예: deck:"일본어" is:due'
            />
            <span className="amgi-field-hint">
              예시: <code>is:due</code> (오늘 만기), <code>is:new</code> (새 카드),{' '}
              <code>tag:중요</code>
            </span>
          </div>
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="add-fd-limit">
              최대 카드 수
            </label>
            <input
              id="add-fd-limit"
              type="number"
              min={1}
              max={9999}
              className="amgi-input tabular"
              value={filteredLimit}
              onChange={(e) => setFilteredLimit(Number(e.target.value) || 100)}
            />
          </div>
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="add-fd-order">
              카드 순서
            </label>
            <select
              id="add-fd-order"
              className="amgi-select"
              value={filteredOrder}
              onChange={(e) => setFilteredOrder(Number(e.target.value))}
            >
              {FILTERED_ORDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="amgi-switch-row">
            <div>
              <div className="amgi-field-label">답변 후 카드 일정 변경</div>
              <div className="amgi-field-hint">
                끄면 미리보기 모드로 복습 일정이 바뀌지 않습니다
              </div>
            </div>
            <Switch
              checked={filteredReschedule}
              onChange={setFilteredReschedule}
              aria-label="답변 후 카드 일정 변경"
            />
          </div>
        </form>
      </SheetOrDialog>

      {/* .colpkg Replace Confirm Dialog */}
      <SheetOrDialog
        open={colpkgConfirm !== null}
        onClose={() => {
          if (!importingColpkg) setColpkgConfirm(null);
        }}
        title="컬렉션 전체 덮어쓰기"
        subtitle={colpkgConfirm?.name}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={importingColpkg}
              onClick={() => setColpkgConfirm(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={importingColpkg}
              onClick={() => void handleConfirmColpkg()}
            >
              {importingColpkg ? '불러오는 중...' : '백업 후 가져오기'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          가져온 <code>.colpkg</code> 파일로 현재 기기의 모든 덱과 학습 기록을 바꿉니다.
          진행하기 전에 현재 데이터는 자동으로 안전 백업됩니다.
        </p>
      </SheetOrDialog>
    </>
  );
};

export default AddActionSheet;
