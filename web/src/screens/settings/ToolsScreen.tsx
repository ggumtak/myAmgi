// 설정 › 도구: 데이터베이스 검사, 미디어 검사, 빈 카드 정리 — straight to the engine
// (`checkDatabase`, `checkMedia`/`trashMediaFiles`, `getEmptyCards`/`removeCards`),
// results in Korean (the backend's own localized text where it has one).
import { useState, type ReactNode } from 'react';
import { tools } from '../../anki';
import type { anki } from '../../anki/proto';
import { describeError } from '../../lib/errors';
import { formatCount } from '../../lib/format';
import { notifyCollectionChanged } from '../../lib/hooks';
import { sanitizeHtml } from '../../lib/sanitize';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/Dialogs';
import { ListSection } from '../../ui/ListRow';
import { Sheet } from '../../ui/Sheet';
import { toast } from '../../ui/Toast';
import './Settings.css';

type Result = { title: string; body: ReactNode; actions?: ReactNode; testId: string } | null;

function Tool({ title, text, button, busy, onRun, testId }: { title: string; text: string; button: string; busy: boolean; onRun: () => void; testId: string }) {
  return (
    <div className="tool" data-testid={testId}>
      <div className="tool__text">
        <span className="tool__title">{title}</span>
        <span className="toggle-row__hint">{text}</span>
      </div>
      <Button onClick={onRun} loading={busy} data-testid={`${testId}-run`}>
        {button}
      </Button>
    </div>
  );
}

export function ToolsScreen() {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [empty, setEmpty] = useState<anki.card_rendering.EmptyCardsReport | null>(null);
  const [keepNotes, setKeepNotes] = useState(true);
  const [trash, setTrash] = useState<string[] | null>(null);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      toast(`실패했습니다: ${describeError(err).message}`, { kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const checkDatabase = () =>
    run('db', async () => {
      const problems = await tools.checkDatabase();
      notifyCollectionChanged();
      setResult({
        title: '데이터베이스 검사',
        testId: 'db-result',
        body: problems.length ? (
          <>
            <p>문제를 찾아 고쳤습니다:</p>
            <ul className="settings__result">
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>문제가 없습니다. 데이터베이스를 다시 정리했습니다.</p>
        ),
      });
    });

  const checkMedia = () =>
    run('media', async () => {
      const r = await tools.checkMedia();
      const unused = r.unused ?? [];
      const missing = r.missing ?? [];
      setResult({
        title: '미디어 검사',
        testId: 'media-result',
        body: (
          <>
            <p data-testid="media-summary">
              {unused.length === 0 && missing.length === 0
                ? '문제가 없습니다. 모든 소리·그림 파일이 카드에서 쓰이고 있습니다.'
                : `사용하지 않는 파일 ${formatCount(unused.length)}개 · 없는 파일 ${formatCount(missing.length)}개`}
            </p>
            {r.report && <pre className="settings__pre">{r.report}</pre>}
          </>
        ),
        actions:
          unused.length > 0 ? (
            <Button variant="danger" onClick={() => setTrash(unused)} data-testid="media-trash">
              사용하지 않는 파일 {formatCount(unused.length)}개 삭제
            </Button>
          ) : undefined,
      });
    });

  const checkEmpty = () =>
    run('empty', async () => {
      const r = await tools.emptyCards();
      if (!r.notes?.length) {
        setResult({ title: '빈 카드 정리', testId: 'empty-result', body: <p>빈 카드가 없습니다.</p> });
        return;
      }
      setKeepNotes(true);
      setEmpty(r);
    });

  const emptyIds = empty ? tools.emptyCardIdsToRemove(empty.notes ?? [], keepNotes) : [];

  return (
    <div className="screen">
      <AppBar title="도구" back />
      <div className="screen__body settings" data-testid="tools-screen">
        <ListSection title="컬렉션 관리">
          <Tool
            title="데이터베이스 검사"
            text="컬렉션 파일의 오류를 찾아 고치고 정리합니다."
            button="검사"
            busy={busy === 'db'}
            onRun={checkDatabase}
            testId="tool-db"
          />
          <Tool
            title="미디어 검사"
            text="카드에서 쓰지 않는 파일과 없는 파일을 찾습니다."
            button="검사"
            busy={busy === 'media'}
            onRun={checkMedia}
            testId="tool-media"
          />
          <Tool
            title="빈 카드 정리"
            text="앞면이 비어 있는 카드(예: 지운 빈칸 번호의 카드)를 찾아 삭제합니다."
            button="찾기"
            busy={busy === 'empty'}
            onRun={checkEmpty}
            testId="tool-empty"
          />
        </ListSection>
      </div>

      <Sheet
        open={!!result}
        onClose={() => setResult(null)}
        title={result?.title}
        testId={result?.testId}
        actions={
          <>
            {result?.actions}
            <Button variant="primary" onClick={() => setResult(null)}>
              확인
            </Button>
          </>
        }
      >
        {result?.body}
      </Sheet>

      <ConfirmDialog
        open={!!empty}
        title="빈 카드 정리"
        danger
        confirmLabel={`${formatCount(emptyIds.length)}장 삭제`}
        message={
          empty && (
            <>
              <p data-testid="empty-message">빈 카드 {formatCount(emptyIds.length)}장을 삭제합니다.</p>
              <label className="settings__check">
                <input type="checkbox" checked={keepNotes} onChange={(e) => setKeepNotes(e.target.checked)} />
                <span>카드가 모두 빈 노트도 지우지 않기 (첫 카드를 남김)</span>
              </label>
              {empty.report && <div className="settings__pre" dangerouslySetInnerHTML={{ __html: sanitizeHtml(empty.report) }} />}
            </>
          )
        }
        onConfirm={async () => {
          try {
            const n = emptyIds.length ? await tools.removeCards(emptyIds) : 0;
            notifyCollectionChanged();
            toast(`빈 카드 ${formatCount(n)}장을 삭제했습니다`);
          } catch (err) {
            toast(`삭제하지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
          }
          setEmpty(null);
        }}
        onClose={() => setEmpty(null)}
      />

      <ConfirmDialog
        open={!!trash}
        title="사용하지 않는 파일 삭제"
        danger
        confirmLabel="삭제"
        message={trash && <p>카드에서 쓰지 않는 파일 {formatCount(trash.length)}개를 미디어 휴지통으로 옮깁니다.</p>}
        onConfirm={async () => {
          try {
            await tools.trashMediaFiles(trash!);
            toast(`파일 ${formatCount(trash!.length)}개를 삭제했습니다`);
            setResult(null);
          } catch (err) {
            toast(`삭제하지 못했습니다: ${describeError(err).message}`, { kind: 'error' });
          }
          setTrash(null);
        }}
        onClose={() => setTrash(null)}
      />
    </div>
  );
}
