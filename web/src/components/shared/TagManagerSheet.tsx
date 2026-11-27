import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as anki from '../../anki';
import { useApp } from '../../context/AppContext';
import {
  IconEdit,
  IconSearch,
  IconSpark,
  IconTag,
  IconTrash,
  SheetOrDialog,
  useToast,
} from '../../ui';

export interface TagManagerSheetProps {
  open: boolean;
  onClose: () => void;
}

export const TagManagerSheet: React.FC<TagManagerSheetProps> = ({ open, onClose }) => {
  const { bumpCollection, navigate } = useApp();
  const { showToast } = useToast();

  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const list = await anki.getAllTags();
      setTags(list.slice().sort((a, b) => a.localeCompare(b, 'ko')));
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '태그 목록을 불러오지 못했습니다.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (open) {
      setQuery('');
      void loadTags();
    }
  }, [open, loadTags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.toLowerCase().includes(q));
  }, [tags, query]);

  const handleClearUnused = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await anki.clearUnusedTags();
      bumpCollection();
      await loadTags();
      const cnt = res.count ?? 0;
      showToast(
        cnt > 0
          ? `사용하지 않는 태그 ${cnt}개를 정리했습니다.`
          : '정리할 미사용 태그가 없습니다.',
        'success'
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '미사용 태그를 정리하지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRenameConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || busy) return;
    const next = renameValue.trim().replace(/\s+/g, '_');
    if (!next || next === renameTarget) {
      setRenameTarget(null);
      return;
    }
    setBusy(true);
    try {
      await anki.renameTags(renameTarget, next);
      setRenameTarget(null);
      bumpCollection();
      await loadTags();
      showToast(`태그를 '${next}'로 변경했습니다.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '태그 이름을 바꾸지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await anki.removeTags(deleteTarget);
      const removed = deleteTarget;
      setDeleteTarget(null);
      bumpCollection();
      await loadTags();
      showToast(`'${removed}' 태그를 삭제했습니다.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : '태그를 삭제하지 못했습니다.',
        'error'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SheetOrDialog
        open={open}
        onClose={onClose}
        title="태그 관리"
        subtitle={`총 ${tags.length.toLocaleString('ko-KR')}개의 태그`}
        maxWidth={540}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busy || loading}
              onClick={() => void handleClearUnused()}
            >
              <IconSpark size={16} />
              <span>미사용 정리</span>
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-primary"
              onClick={onClose}
            >
              닫기
            </button>
          </>
        }
      >
        <div className="amgi-cmd-search">
          <IconSearch size={17} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="태그 이름으로 검색..."
            aria-label="태그 검색"
          />
        </div>

        {loading ? (
          <p className="amgi-prose" style={{ margin: '12px 0', color: 'var(--text-2)' }}>
            태그 목록을 불러오는 중...
          </p>
        ) : filtered.length === 0 ? (
          <p className="amgi-prose" style={{ margin: '12px 0', color: 'var(--text-2)' }}>
            {tags.length === 0
              ? '아직 등록된 태그가 없습니다.'
              : '검색 결과와 일치하는 태그가 없습니다.'}
          </p>
        ) : (
          <div className="amgi-cmd-list">
            {filtered.map((tag) => (
              <div key={tag} className="amgi-cmd-row" style={{ cursor: 'default' }}>
                <button
                  type="button"
                  className="amgi-btn amgi-btn-ghost"
                  style={{
                    flex: 1,
                    justifyContent: 'flex-start',
                    padding: '0 6px',
                    minHeight: 44,
                    color: 'var(--text)',
                    overflow: 'hidden',
                  }}
                  onClick={() => {
                    onClose();
                    navigate(`#/browse?q=${encodeURIComponent(`tag:"${tag}"`)}`);
                  }}
                >
                  <IconTag size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag}
                  </span>
                </button>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="amgi-btn amgi-btn-ghost amgi-btn-icon compact"
                    data-compact="true"
                    aria-label={`${tag} 이름 바꾸기`}
                    onClick={() => {
                      setRenameTarget(tag);
                      setRenameValue(tag);
                    }}
                  >
                    <IconEdit size={16} />
                  </button>
                  <button
                    type="button"
                    className="amgi-btn amgi-btn-ghost amgi-btn-icon compact"
                    data-compact="true"
                    aria-label={`${tag} 삭제`}
                    onClick={() => setDeleteTarget(tag)}
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetOrDialog>

      <SheetOrDialog
        open={renameTarget !== null}
        onClose={() => {
          if (!busy) setRenameTarget(null);
        }}
        title="태그 이름 바꾸기"
        subtitle={renameTarget ?? undefined}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busy}
              onClick={() => setRenameTarget(null)}
            >
              취소
            </button>
            <button
              type="submit"
              form="amgi-rename-tag-form"
              className="amgi-btn amgi-btn-primary"
              disabled={busy}
            >
              {busy ? '저장 중...' : '저장'}
            </button>
          </>
        }
      >
        <form
          id="amgi-rename-tag-form"
          className="amgi-modal-form"
          onSubmit={(e) => void handleRenameConfirm(e)}
        >
          <div className="amgi-field-group">
            <label className="amgi-field-label" htmlFor="rename-tag-input">
              새 태그 이름
            </label>
            <input
              id="rename-tag-input"
              type="text"
              className="amgi-input"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="예: 일본어::JLPT"
            />
            <span className="amgi-field-hint">
              <code>::</code>를 사용하면 계층형 하위 태그로 정리할 수 있습니다.
            </span>
          </div>
        </form>
      </SheetOrDialog>

      <SheetOrDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!busy) setDeleteTarget(null);
        }}
        title="태그 삭제"
        subtitle={deleteTarget ?? undefined}
        footer={
          <>
            <button
              type="button"
              className="amgi-btn amgi-btn-secondary"
              disabled={busy}
              onClick={() => setDeleteTarget(null)}
            >
              취소
            </button>
            <button
              type="button"
              className="amgi-btn amgi-btn-danger"
              disabled={busy}
              onClick={() => void handleDeleteConfirm()}
            >
              {busy ? '삭제 중...' : '삭제'}
            </button>
          </>
        }
      >
        <p className="amgi-prose" style={{ margin: 0 }}>
          모든 노트에서 <strong>{deleteTarget}</strong> 태그를 제거합니다. 노트와 카드는
          삭제되지 않습니다.
        </p>
      </SheetOrDialog>
    </>
  );
};

export default TagManagerSheet;
