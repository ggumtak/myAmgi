// `#/export?deck=<id>`: export a deck (.apkg) or the whole collection (.apkg / .colpkg)
// with Anki's options (scheduling, media, legacy format). The host writes the file;
// PC downloads it through `/api/host/download`, Android hands it to the share sheet.
import { useState } from 'react';
import { decks } from '../../anki';
import { host, hostInfoStore, type ExportResult } from '../../host';
import { describeError } from '../../lib/errors';
import { formatBytes, formatCount } from '../../lib/format';
import { useAsync } from '../../lib/hooks';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { ListSection } from '../../ui/ListRow';
import { LoadingState } from '../../ui/Spinner';
import { ErrorState } from '../../ui/States';
import { toast } from '../../ui/Toast';
import { Toggle } from '../settings/Toggle';
import '../settings/Settings.css';

type Format = 'apkg' | 'colpkg';

/** Saves (PC) or shares (Android) a file the host exported. */
export async function deliverExport(r: ExportResult): Promise<void> {
  const info = hostInfoStore.get() ?? (await hostInfoStore.load());
  if (info.platform === 'android') {
    await host.platform.share(r.path, r.name);
    return;
  }
  // A real request to the download URL (Content-Disposition: attachment), never a blob: URL:
  // browsers save it, and the Android shell intercepts it and opens the system save dialog.
  // The file name comes from the host's Content-Disposition.
  const a = document.createElement('a');
  a.href = host.downloadUrl(r.path, r.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function ExportScreen({ deckId }: { deckId: number }) {
  const names = useAsync(() => decks.deckNames({ includeFiltered: false, skipEmptyDefault: true }), []);
  const [format, setFormat] = useState<Format>('apkg');
  const [deck, setDeck] = useState<number>(deckId);
  const [withScheduling, setWithScheduling] = useState(true);
  const [withMedia, setWithMedia] = useState(true);
  const [legacy, setLegacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ExportResult | null>(null);
  const android = hostInfoStore.get()?.platform === 'android';

  const run = async () => {
    setBusy(true);
    setDone(null);
    try {
      const r =
        format === 'colpkg'
          ? await host.exportCollection({ withMedia, legacy })
          : await host.exportPackage({ deckId: deck || undefined, withScheduling, withMedia, legacy });
      setDone(r);
      toast(r.notes !== undefined ? `내보내기 완료: 노트 ${formatCount(r.notes)}개` : '내보내기 완료');
      await deliverExport(r);
    } catch (err) {
      toast(`내보내지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (names.error && !names.data) {
    body = <ErrorState error={names.error} title="덱 목록을 불러오지 못했습니다" onRetry={names.reload} />;
  } else if (!names.data) {
    body = <LoadingState />;
  } else {
    const deckName = names.data.find((d) => d.id === deck)?.name;
    body = (
      <>
        <ListSection title="형식">
          <div role="radiogroup" aria-label="형식" className="radio-list">
            {(
              [
                ['apkg', '덱 패키지 (.apkg)', '덱을 다른 Anki로 옮기거나 나눌 때'],
                ['colpkg', '컬렉션 패키지 (.colpkg)', '모든 덱·설정을 통째로 백업하거나 옮길 때'],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className="radio-row" data-testid={`export-format-${value}`}>
                <input type="radio" name="export-format" value={value} checked={format === value} onChange={() => setFormat(value)} />
                <span className="radio-row__mark" aria-hidden="true" />
                <span className="radio-row__text">
                  <span>{label}</span>
                  <span className="radio-row__hint">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </ListSection>

        {format === 'apkg' && (
          <ListSection title="덱">
            <label className="toggle-row">
              <span className="toggle-row__text">
                <span>내보낼 덱</span>
                <span className="toggle-row__hint">하위 덱도 함께 들어갑니다</span>
              </span>
              <select className="settings__select" value={deck} onChange={(e) => setDeck(Number(e.target.value))} data-testid="export-deck">
                <option value={0}>모든 덱</option>
                {names.data.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </ListSection>
        )}

        <ListSection title="포함할 내용">
          {format === 'apkg' && (
            <Toggle
              label="학습 기록 포함"
              hint="끄면 카드가 새 카드로 들어갑니다 (나눠 줄 때)"
              checked={withScheduling}
              onChange={setWithScheduling}
              testId="export-scheduling"
            />
          )}
          <Toggle label="미디어 포함" hint="소리·그림 파일" checked={withMedia} onChange={setWithMedia} testId="export-media" />
          <Toggle label="이전 Anki 버전 호환" hint="Anki 2.1.50 이전 버전에서 열 때만 켜세요" checked={legacy} onChange={setLegacy} testId="export-legacy" />
        </ListSection>

        <div className="settings__buttons">
          <Button variant="primary" loading={busy} onClick={run} data-testid="export-run">
            {android ? '내보내고 공유' : '내보내기'}
          </Button>
        </div>
        {done && (
          <div className="settings__status" data-testid="export-done">
            <span>
              '{done.name}' ({formatBytes(done.size)}
              {done.notes !== undefined ? ` · 노트 ${formatCount(done.notes)}개` : ''}) 를 만들었습니다.
            </span>
            <div>
              <Button variant="text" onClick={() => void deliverExport(done).catch((err) => toast(describeError(err).message, { kind: 'error' }))}>
                {android ? '다시 공유' : '다시 내려받기'}
              </Button>
            </div>
          </div>
        )}
        {format === 'apkg' && deckName && <p className="settings__note">'{deckName}' 덱을 내보냅니다.</p>}
      </>
    );
  }

  return (
    <div className="screen">
      <AppBar title="내보내기" back />
      <div className="screen__body settings" data-testid="export-screen">
        {body}
      </div>
    </div>
  );
}
