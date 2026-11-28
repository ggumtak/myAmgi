import { useEffect, useRef, useState } from 'react';
import * as anki from '../../anki';
import { SheetOrDialog, useToast } from '../../ui';
import {
  NO_OLD_INDEX,
  normaliseMap,
  setOldIndex,
  unusedOldIndices,
} from './changeNotetypeMapping';

export interface ChangeNotetypeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Notes to convert; they must all use `oldNotetypeId`. */
  noteIds: number[];
  oldNotetypeId: number;
  /** Shown above the mapping (e.g. that pending edits will be saved first). */
  notice?: string;
  /** Runs right before the change is applied (e.g. to save pending editor edits). */
  beforeChange?: () => Promise<void>;
  /** Called after a successful change. */
  onChanged: () => void;
}

/**
 * Change-notetype mapping shared by the browser and the note editor. One row per field /
 * template of the NEW notetype, each choosing the OLD item it takes its content from,
 * which is exactly how `ChangeNotetypeRequest.newFields/newTemplates` are indexed.
 */
export function ChangeNotetypeDialog({
  open,
  onClose,
  noteIds,
  oldNotetypeId,
  notice,
  beforeChange,
  onChanged,
}: ChangeNotetypeDialogProps) {
  const { showToast } = useToast();
  const [names, setNames] = useState<anki.NotetypeNameId[]>([]);
  const [targetId, setTargetId] = useState(0);
  const [info, setInfo] = useState<anki.ChangeNotetypeInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [fieldMap, setFieldMap] = useState<number[]>([]);
  const [templateMap, setTemplateMap] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const infoSeqRef = useRef(0);

  const loadInfo = async (nextTarget: number) => {
    const seq = ++infoSeqRef.current;
    setTargetId(nextTarget);
    // Never keep the previous target's maps while (or after failing) loading the new one.
    setInfo(null);
    setInfoError(null);
    setFieldMap([]);
    setTemplateMap([]);
    if (!nextTarget) return;
    setLoadingInfo(true);
    try {
      const res = await anki.getChangeNotetypeInfo(oldNotetypeId, nextTarget);
      if (seq !== infoSeqRef.current) return;
      setInfo(res);
      setFieldMap(normaliseMap(res.input?.newFields, res.newFieldNames.length));
      const tplApplies = (res.input?.newTemplates?.length ?? 0) > 0;
      setTemplateMap(
        tplApplies ? normaliseMap(res.input?.newTemplates, res.newTemplateNames.length) : []
      );
    } catch (err) {
      if (seq !== infoSeqRef.current) return;
      setInfoError(
        err instanceof Error ? err.message : '노트 유형 연결 정보를 불러오지 못했습니다.'
      );
    } finally {
      if (seq === infoSeqRef.current) setLoadingInfo(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBusy(false);
    anki
      .getNotetypeNames()
      .then((list) => {
        if (cancelled) return;
        setNames(list);
        const other = list.find((n) => anki.toNumber(n.id) !== oldNotetypeId);
        void loadInfo(other ? anki.toNumber(other.id) : oldNotetypeId);
      })
      .catch((err) => {
        if (cancelled) return;
        setInfoError(err instanceof Error ? err.message : '노트 유형 목록을 불러오지 못했습니다.');
      });
    return () => {
      cancelled = true;
      infoSeqRef.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, oldNotetypeId]);

  const handleConfirm = async () => {
    if (!info?.input || busy) return;
    setBusy(true);
    try {
      if (beforeChange) await beforeChange();
      await anki.changeNotetype({
        ...info.input,
        noteIds,
        newFields: fieldMap,
        newTemplates: templateMap,
      });
      showToast(`노트 ${noteIds.length.toLocaleString()}개의 노트 유형을 바꿨습니다.`, 'success');
      onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : '노트 유형을 바꾸지 못했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const lostFields = info ? unusedOldIndices(fieldMap, info.oldFieldNames.length) : [];
  const lostTemplates =
    info && templateMap.length > 0
      ? unusedOldIndices(templateMap, info.oldTemplateNames.length)
      : [];

  return (
    <SheetOrDialog
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      dismissible={!busy}
      title="노트 유형 바꾸기"
      subtitle={`노트 ${noteIds.length.toLocaleString()}개${
        info?.oldNotetypeName ? ` · 현재: ${info.oldNotetypeName}` : ''
      }`}
      footer={
        <>
          <button
            type="button"
            className="amgi-btn amgi-btn-secondary"
            disabled={busy}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="amgi-btn amgi-btn-primary"
            disabled={busy || !info?.input || loadingInfo}
            onClick={() => void handleConfirm()}
          >
            {busy ? '바꾸는 중...' : '바꾸기'}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notice && (
          <p className="amgi-prose" style={{ margin: 0 }}>
            {notice}
          </p>
        )}
        <label className="form-field">
          <span>새 노트 유형</span>
          <select
            className="amgi-select"
            value={targetId}
            disabled={busy}
            onChange={(e) => void loadInfo(Number(e.target.value))}
          >
            {names.map((n) => {
              const id = anki.toNumber(n.id);
              return (
                <option key={id} value={id}>
                  {n.name}
                </option>
              );
            })}
          </select>
        </label>

        {loadingInfo && <div style={{ color: 'var(--text-2)' }}>연결 정보를 불러오는 중...</div>}
        {infoError && (
          <div role="alert" style={{ color: 'var(--danger, #D93025)' }}>
            {infoError}
          </div>
        )}

        {info && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700 }}>필드: 새 필드마다 가져올 기존 필드</div>
            {info.newFieldNames.map((newName, newIdx) => (
              <label key={`f-${newIdx}`} className="form-field">
                <span>{newName} ←</span>
                <select
                  className="amgi-select"
                  value={fieldMap[newIdx] ?? NO_OLD_INDEX}
                  disabled={busy}
                  onChange={(e) =>
                    setFieldMap((prev) =>
                      setOldIndex(prev, newIdx, Number(e.target.value), false)
                    )
                  }
                >
                  <option value={NO_OLD_INDEX}>(비워 두기)</option>
                  {info.oldFieldNames.map((oldName, oldIdx) => (
                    <option key={oldIdx} value={oldIdx}>
                      {oldName}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {lostFields.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                내용이 사라지는 필드: {lostFields.map((i) => info.oldFieldNames[i]).join(', ')}
              </div>
            )}

            {templateMap.length > 0 && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
                  카드: 새 카드 유형마다 이어받을 기존 카드(학습 기록 포함)
                </div>
                {info.newTemplateNames.map((newName, newIdx) => (
                  <label key={`t-${newIdx}`} className="form-field">
                    <span>{newName} ←</span>
                    <select
                      className="amgi-select"
                      value={templateMap[newIdx] ?? NO_OLD_INDEX}
                      disabled={busy}
                      onChange={(e) =>
                        setTemplateMap((prev) =>
                          setOldIndex(prev, newIdx, Number(e.target.value), true)
                        )
                      }
                    >
                      <option value={NO_OLD_INDEX}>(이어받지 않음)</option>
                      {info.oldTemplateNames.map((oldName, oldIdx) => (
                        <option key={oldIdx} value={oldIdx}>
                          {oldName}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {lostTemplates.length > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    삭제되는 카드: {lostTemplates.map((i) => info.oldTemplateNames[i]).join(', ')}
                  </div>
                )}
              </>
            )}

            <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
              노트 유형을 바꾸면 다음 동기화 때 전체 동기화가 필요합니다.
            </div>
          </>
        )}
      </div>
    </SheetOrDialog>
  );
}
