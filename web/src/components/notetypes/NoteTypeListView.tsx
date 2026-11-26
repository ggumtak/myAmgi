import { useCallback, useEffect, useState } from 'react';
import * as anki from '../../anki';
import type { AnkiTypes } from '../../anki/generated';
import { useApp } from '../../context/AppContext';
import {
  ActionMenu,
  ErrorState,
  IconArrowLeft,
  IconCopy,
  IconEdit,
  IconMore,
  IconPlus,
  IconTrash,
  SectionCard,
  SheetOrDialog,
  useToast,
} from '../../ui';
import './notetypes.css';

interface NoteTypeSummary {
  id: number;
  name: string;
  useCount: number;
  fieldCount: number;
  templateCount: number;
  isCloze: boolean;
}

const STOCK_PRESETS: Array<{ kind: anki.StockNotetypeKind; label: string; desc: string }> = [
  {
    kind: anki.StockNotetypeKind.KIND_BASIC,
    label: '기본 (앞면 → 뒷면)',
    desc: '가장 기본적인 앞면·뒷면 카드 1장 구성',
  },
  {
    kind: anki.StockNotetypeKind.KIND_BASIC_AND_REVERSED,
    label: '기본 + 반대 방향 (양방향 카드 2장)',
    desc: '앞면→뒷면, 뒷면→앞면 카드 2장을 자동 생성',
  },
  {
    kind: anki.StockNotetypeKind.KIND_BASIC_OPTIONAL_REVERSED,
    label: '기본 + 선택적 반대 방향',
    desc: '카드 추가 필드가 채워졌을 때만 반대 카드 생성',
  },
  {
    kind: anki.StockNotetypeKind.KIND_BASIC_TYPING,
    label: '기본 + 정답 직접 입력',
    desc: '학습 시 정답을 키보드로 입력해 비교합니다',
  },
  {
    kind: anki.StockNotetypeKind.KIND_CLOZE,
    label: '빈칸 채우기 (Cloze)',
    desc: '{{c1::...}} 문법으로 빈칸 카드를 생성합니다',
  },
];

export const NoteTypeListView: React.FC = () => {
  const { collectionVersion, bumpCollection, navigate, goBack } = useApp();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NoteTypeSummary[]>([]);
  const [busy, setBusy] = useState(false);

  // Create modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createSource, setCreateSource] = useState<'stock' | 'clone'>('stock');
  const [stockKind, setStockKind] = useState<anki.StockNotetypeKind>(
    anki.StockNotetypeKind.KIND_BASIC
  );
  const [cloneSourceId, setCloneSourceId] = useState<number>(0);
  const [newName, setNewName] = useState('');

  // Row action menu & rename/delete modals
  const [menuTarget, setMenuTarget] = useState<NoteTypeSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<NoteTypeSummary | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NoteTypeSummary | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const counts = await anki.getNotetypeNamesAndCounts();
      const details = await Promise.all(
        counts.map(async (entry) => {
          const id = anki.toNumber(entry.id);
          const useCount = entry.useCount ?? 0;
          try {
            const nt = await anki.getNotetype(id);
            return {
              id,
              name: entry.name ?? nt.name ?? '이름 없음',
              useCount,
              fieldCount: nt.fields?.length ?? 0,
              templateCount: nt.templates?.length ?? 0,
              isCloze: nt.config?.kind === anki.NotetypeKind.KIND_CLOZE,
            };
          } catch {
            return {
              id,
              name: entry.name ?? '이름 없음',
              useCount,
              fieldCount: 0,
              templateCount: 0,
              isCloze: false,
            };
          }
        })
      );
      setItems(details);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '노트 유형 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList, collectionVersion]);

  const handleOpenAddModal = () => {
    setCreateSource('stock');
    setStockKind(anki.StockNotetypeKind.KIND_BASIC);
    setCloneSourceId(items[0]?.id ?? 0);
    setNewName('새 노트 유형');
    setAddModalOpen(true);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      let createdId = 0;
      if (createSource === 'stock') {
        const legacyJson = await anki.getStockNotetypeLegacy<Record<string, unknown>>(
          stockKind
        );
        legacyJson.id = 0;
        legacyJson.name = trimmed;
        createdId = await anki.addOrUpdateNotetype({
          json: legacyJson,
          preserveUsnAndMtime: false,
          skipChecks: false,
        });
      } else {
        const src = await anki.getNotetype(cloneSourceId);
        const cloned: AnkiTypes.notetypes.Notetype.$Properties = {
          id: 0,
          name: trimmed,
          config: src.config,
          fields: (src.fields ?? []).map((f) => ({
            ord: f.ord,
            name: f.name,
            config: f.config ? { ...f.config, id: undefined } : undefined,
          })),
          templates: (src.templates ?? []).map((t) => ({
            ord: t.ord,
            name: t.name,
            config: t.config ? { ...t.config, id: undefined } : undefined,
          })),
        };
        const res = await anki.addNotetype(cloned);
        createdId = anki.toNumber(res.id);
      }

      setAddModalOpen(false);
      bumpCollection();
      showToast(`"${trimmed}" 노트 유형을 만들었습니다.`, 'success');
      await loadList();
      if (createdId > 0) {
        navigate(`#/notetype/${createdId}`);
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형을 만들지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCloneRow = async (item: NoteTypeSummary) => {
    if (busy) return;
    setBusy(true);
    try {
      const src = await anki.getNotetype(item.id);
      const cloneName = `${item.name} 복사본`;
      const cloned: AnkiTypes.notetypes.Notetype.$Properties = {
        id: 0,
        name: cloneName,
        config: src.config,
        fields: (src.fields ?? []).map((f) => ({
          ord: f.ord,
          name: f.name,
          config: f.config ? { ...f.config, id: undefined } : undefined,
        })),
        templates: (src.templates ?? []).map((t) => ({
          ord: t.ord,
          name: t.name,
          config: t.config ? { ...t.config, id: undefined } : undefined,
        })),
      };
      await anki.addNotetype(cloned);
      bumpCollection();
      showToast(`"${cloneName}" 노트 유형을 복제했습니다.`, 'success');
      await loadList();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형을 복제하지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    const trimmed = renameInput.trim();
    if (!renameTarget || !trimmed || busy) return;
    setBusy(true);
    try {
      const nt = await anki.getNotetype(renameTarget.id);
      await anki.updateNotetype({
        id: nt.id,
        name: trimmed,
        mtimeSecs: nt.mtimeSecs,
        usn: nt.usn,
        config: nt.config,
        fields: nt.fields,
        templates: nt.templates,
      });
      setRenameTarget(null);
      bumpCollection();
      showToast('노트 유형 이름을 바꾸었습니다.', 'success');
      await loadList();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '이름을 바꾸지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRequestDelete = (item: NoteTypeSummary) => {
    if (item.useCount > 0) {
      showToast(
        `이 노트 유형을 사용하는 노트가 ${item.useCount}개 있어 삭제할 수 없습니다.`,
        'error'
      );
      return;
    }
    setDeleteTarget(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await anki.removeNotetype(deleteTarget.id);
      setDeleteTarget(null);
      bumpCollection();
      showToast('노트 유형을 삭제했습니다.', 'success');
      await loadList();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '노트 유형을 삭제하지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="amgi-nt-list-root" data-testid="notetype-list-view">
      <header className="amgi-topbar amgi-nt-topbar">
        <div className="amgi-topbar-left">
          <button
            type="button"
            className="amgi-btn amgi-btn-ghost amgi-btn-icon"
            aria-label="뒤로 가기"
            onClick={() => goBack('#/decks')}
          >
            <IconArrowLeft size={20} />
          </button>
          <h1 className="amgi-topbar-title">노트 유형 관리</h1>
        </div>

        <div className="amgi-topbar-right">
          <button
            type="button"
            className="amgi-btn amgi-btn-primary amgi-btn-sm"
            onClick={handleOpenAddModal}
          >
            <IconPlus size={16} />
            <span>새 노트 유형</span>
          </button>
        </div>
      </header>

      <div className="amgi-nt-list-body">
        {error ? (
          <ErrorState
            title="노트 유형을 불러오지 못했습니다"
            message={error}
            onRetry={() => void loadList()}
          />
        ) : loading ? (
          <SectionCard>
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-2)' }}>
              노트 유형 목록을 불러오는 중...
            </div>
          </SectionCard>
        ) : (
          <SectionCard title={`전체 ${items.length}개`}>
            {items.map((item) => (
              <div key={item.id} className="amgi-nt-row">
                <button
                  type="button"
                  className="amgi-nt-row-main"
                  onClick={() => navigate(`#/notetype/${item.id}`)}
                >
                  <div className="amgi-nt-title-line">
                    <span className="amgi-nt-name">{item.name}</span>
                    {item.isCloze && <span className="amgi-nt-badge">빈칸 유형</span>}
                  </div>
                  <div className="amgi-nt-meta tabular">
                    노트 {item.useCount.toLocaleString()}개 · 필드 {item.fieldCount}개 · 카드{' '}
                    {item.templateCount}장
                  </div>
                </button>

                <button
                  type="button"
                  className="amgi-btn amgi-btn-ghost amgi-btn-icon"
                  aria-label={`${item.name} 작업 메뉴`}
                  onClick={() => setMenuTarget(item)}
                >
                  <IconMore size={20} />
                </button>
              </div>
            ))}
          </SectionCard>
        )}
      </div>

      {/* Row Action Menu */}
      <ActionMenu
        open={menuTarget !== null}
        onClose={() => setMenuTarget(null)}
        title={menuTarget?.name ?? ''}
        subtitle={
          menuTarget
            ? `노트 ${menuTarget.useCount.toLocaleString()}개 사용 중`
            : undefined
        }
        items={
          menuTarget
            ? [
                {
                  id: 'edit',
                  label: '편집 (필드 / 카드 템플릿 / 스타일)',
                  icon: <IconEdit size={18} />,
                  onSelect: () => navigate(`#/notetype/${menuTarget.id}`),
                },
                {
                  id: 'rename',
                  label: '이름 바꾸기',
                  onSelect: () => {
                    setRenameInput(menuTarget.name);
                    setRenameTarget(menuTarget);
                  },
                },
                {
                  id: 'clone',
                  label: '복제',
                  icon: <IconCopy size={18} />,
                  onSelect: () => void handleCloneRow(menuTarget),
                },
                {
                  id: 'delete',
                  label: '삭제',
                  description:
                    menuTarget.useCount > 0
                      ? `사용 중인 노트 ${menuTarget.useCount}개가 있어 삭제할 수 없습니다`
                      : '사용하지 않는 노트 유형을 삭제합니다',
                  icon: <IconTrash size={18} />,
                  destructive: true,
                  onSelect: () => handleRequestDelete(menuTarget),
                },
              ]
            : []
        }
      />

      {/* Add Notetype Modal */}
      <SheetOrDialog
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="새 노트 유형 만들기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setAddModalOpen(false)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!newName.trim() || busy}
              className="amgi-btn amgi-btn-primary"
              onClick={() => void handleCreate()}
            >
              {busy ? '만드는 중...' : '만들기'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`amgi-btn amgi-btn-sm ${
                createSource === 'stock' ? 'amgi-btn-primary' : 'amgi-btn-secondary'
              }`}
              style={{ flex: 1 }}
              onClick={() => setCreateSource('stock')}
            >
              기본 프리셋에서
            </button>
            <button
              type="button"
              className={`amgi-btn amgi-btn-sm ${
                createSource === 'clone' ? 'amgi-btn-primary' : 'amgi-btn-secondary'
              }`}
              style={{ flex: 1 }}
              disabled={items.length === 0}
              onClick={() => setCreateSource('clone')}
            >
              기존 유형에서 복제
            </button>
          </div>

          {createSource === 'stock' ? (
            <div className="amgi-filter-list">
              {STOCK_PRESETS.map((p) => (
                <button
                  key={p.kind}
                  type="button"
                  className={`amgi-filter-option ${
                    stockKind === p.kind ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setStockKind(p.kind);
                    setNewName(p.label.split(' (')[0]);
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>{p.label}</span>
                    <span style={{ fontSize: 12, opacity: 0.8, fontWeight: 500 }}>
                      {p.desc}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <label className="form-field">
              <span>복제할 노트 유형</span>
              <select
                className="amgi-select"
                value={cloneSourceId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setCloneSourceId(id);
                  const found = items.find((it) => it.id === id);
                  if (found) setNewName(`${found.name} 복사본`);
                }}
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="form-field">
            <span>새 이름</span>
            <input
              type="text"
              className="amgi-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
        </div>
      </SheetOrDialog>

      {/* Rename Modal */}
      <SheetOrDialog
        open={renameTarget !== null}
        onClose={() => setRenameTarget(null)}
        title="노트 유형 이름 바꾸기"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setRenameTarget(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={!renameInput.trim() || busy}
              className="amgi-btn amgi-btn-primary"
              onClick={() => void handleRename()}
            >
              변경
            </button>
          </>
        }
      >
        <label className="form-field">
          <span>노트 유형 이름</span>
          <input
            type="text"
            className="amgi-input"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
          />
        </label>
      </SheetOrDialog>

      {/* Delete Confirm Modal */}
      <SheetOrDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="노트 유형 삭제"
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              className="amgi-btn amgi-btn-danger"
              onClick={() => void handleConfirmDelete()}
            >
              삭제
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          <strong>{deleteTarget?.name}</strong> 노트 유형을 삭제할까요?
        </p>
      </SheetOrDialog>
    </div>
  );
};
