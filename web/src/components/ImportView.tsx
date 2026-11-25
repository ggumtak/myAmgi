import React, { useState } from 'react';
import { Deck, NoteType } from '../types/models';
import { importApkgFile } from '../importers/apkg';
import { CsvParseResult, importCsvFile } from '../importers/csv';

interface ImportViewProps {
  decks: Deck[];
  noteTypes: NoteType[];
  onImportApkgComplete: (result: Awaited<ReturnType<typeof importApkgFile>>) => Promise<void>;
  onImportCsvComplete: (
    deckId: number,
    noteTypeId: number,
    rows: string[][]
  ) => Promise<void>;
}

export const ImportView: React.FC<ImportViewProps> = ({
  decks,
  noteTypes,
  onImportApkgComplete,
  onImportCsvComplete,
}) => {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const [csvPreview, setCsvPreview] = useState<CsvParseResult | null>(null);
  const [targetDeckId, setTargetDeckId] = useState<number>(() => decks[0]?.id ?? 1);
  const [targetNtId, setTargetNtId] = useState<number>(() => noteTypes[0]?.id ?? 0);
  const [skipHeader, setSkipHeader] = useState(false);

  const handleApkgUpload = async (file: File) => {
    setBusy(true);
    setError('');
    setStatus('.apkg 압축 해제 및 SQLite / Protobuf 파싱 중...');
    try {
      const result = await importApkgFile(file);
      await onImportApkgComplete(result);
      setStatus(
        `가져오기 완료 (${result.format === 'v21b' ? 'Zstd v21b' : 'Legacy'}): ` +
          `덱 ${result.decks.length}개, 노트 ${result.notes.length}개, ` +
          `카드 ${result.cards.length}개, 미디어 ${result.media.length}개`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const handleCsvUpload = async (file: File) => {
    setBusy(true);
    setError('');
    setStatus('인코딩 자동 감지 및 파싱 중...');
    try {
      const parsed = await importCsvFile(file);
      setCsvPreview(parsed);
      setStatus(
        `인코딩 감지: ${parsed.encoding.toUpperCase()} · 구분자: ${
          parsed.delimiter === '\t' ? 'TAB' : parsed.delimiter
        } · ${parsed.rows.length}행`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCsv = async () => {
    if (!csvPreview) return;
    setBusy(true);
    setError('');
    try {
      const rows = skipHeader ? csvPreview.rows.slice(1) : csvPreview.rows;
      await onImportCsvComplete(targetDeckId, targetNtId, rows);
      setStatus(`CSV 카드 ${rows.length}개 가져오기 완료!`);
      setCsvPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="import-grid">
      <div className="card-surface panel-pad">
        <h3>Anki 패키지 (.apkg) 가져오기</h3>
        <p className="muted-text small">
          레거시 (<code>collection.anki2 / anki21</code>) 및 최신 Zstd Protobuf (
          <code>collection.anki21b</code>), FSRS <code>cards.data</code> (s/d/dr), 미디어 파일을
          모두 지원합니다.
        </p>

        <label className="dropzone">
          <input
            type="file"
            accept=".apkg"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleApkgUpload(f);
            }}
          />
          <span className="dropzone-title">📦 .apkg 파일 선택</span>
          <span className="muted-text small">클릭하여 로컬 .apkg 파일을 불러오세요</span>
        </label>
      </div>

      <div className="card-surface panel-pad">
        <h3>CSV / TSV / TXT 가져오기</h3>
        <p className="muted-text small">
          UTF-8 (BOM 유무), UTF-16 LE/BE, CP949/EUC-KR, Shift-JIS 인코딩을 자동으로 감지합니다.
        </p>

        <label className="dropzone">
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCsvUpload(f);
            }}
          />
          <span className="dropzone-title">📄 .csv / .tsv / .txt 파일 선택</span>
          <span className="muted-text small">클릭하여 텍스트 단어장을 불러오세요</span>
        </label>

        {csvPreview && (
          <div className="csv-preview-box">
            <div className="form-grid-2">
              <label className="form-field">
                <span>대상 덱</span>
                <select
                  value={targetDeckId}
                  onChange={(e) => setTargetDeckId(Number(e.target.value))}
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>노트 타입</span>
                <select
                  value={targetNtId}
                  onChange={(e) => setTargetNtId(Number(e.target.value))}
                >
                  {noteTypes.map((nt) => (
                    <option key={nt.id} value={nt.id}>
                      {nt.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={skipHeader}
                onChange={(e) => setSkipHeader(e.target.checked)}
              />
              <span>첫 번째 행(헤더) 건너뛰기</span>
            </label>

            <div className="preview-table-wrap">
              <table className="preview-table">
                <tbody>
                  {csvPreview.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      {r.slice(0, 4).map((cell, ci) => (
                        <td key={ci}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void handleConfirmCsv()}
            >
              {skipHeader ? csvPreview.rows.length - 1 : csvPreview.rows.length}행 가져오기 실행
            </button>
          </div>
        )}
      </div>

      {(status || error) && (
        <div className={`card-surface panel-pad full-span ${error ? 'alert-error' : 'alert-ok'}`}>
          {error ? `⚠️ 오류: ${error}` : `✅ ${status}`}
        </div>
      )}
    </div>
  );
};
