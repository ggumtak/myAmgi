// Import: file picker → streamed upload with progress → `import.file` →
//  - .apkg / text: continue on the official import page (route `#/import/<kind>?route=`)
//  - .colpkg: destructive confirmation naming the file, then the host replaces the collection.
// One controller for the whole app (ImportFlow is mounted in App), so the deck-list
// FAB, the rail "추가" button and files opened with the app (`open-file`) share it.
import { useRef, useSyncExternalStore, type ReactElement } from 'react';
import { host, type ImportResult } from '../host';
import { ConfirmDialog } from '../ui/Dialogs';
import { Sheet } from '../ui/Sheet';
import { toast } from '../ui/Toast';
import { describeError } from './errors';
import { notifyCollectionChanged } from './hooks';
import { navigate } from './router';

export const IMPORT_ACCEPT = '.apkg,.colpkg,.txt,.csv,.tsv';

type Flow =
  | { step: 'idle' }
  | { step: 'uploading'; name: string; fraction: number | null }
  | { step: 'classifying'; name: string }
  | { step: 'confirm-colpkg'; name: string; path: string }
  | { step: 'replacing'; name: string; path: string };

let flow: Flow = { step: 'idle' };
const listeners = new Set<() => void>();
const set = (f: Flow) => {
  flow = f;
  listeners.forEach((l) => l());
};

/** The hash route that continues an apkg/csv import on the official page. */
export function importRoute(r: ImportResult): string {
  return `/import/${r.kind}?route=${encodeURIComponent(r.route ?? '')}`;
}

async function classify(path: string, name: string) {
  set({ step: 'classifying', name });
  const r = await host.importFile(path, name);
  if (r.kind === 'colpkg') {
    set({ step: 'confirm-colpkg', name, path: r.path });
    return;
  }
  set({ step: 'idle' });
  navigate(importRoute(r));
}

/** Uploads a picked file and continues the import. */
export async function importBlob(file: Blob, name: string): Promise<void> {
  if (flow.step !== 'idle') return;
  try {
    set({ step: 'uploading', name, fraction: 0 });
    const up = await host.upload(file, name, (fraction) => {
      if (flow.step === 'uploading') set({ ...flow, fraction });
    });
    await classify(up.path, up.name || name);
  } catch (err) {
    set({ step: 'idle' });
    toast(`가져오기 실패: ${describeError(err).message}`, { kind: 'error' });
  }
}

/** A file the host already has (e.g. opened with the app on Android: the `open-file` event). */
export async function importHostFile(path: string, name: string): Promise<void> {
  if (flow.step !== 'idle') return;
  try {
    await classify(path, name);
  } catch (err) {
    set({ step: 'idle' });
    toast(`가져오기 실패: ${describeError(err).message}`, { kind: 'error' });
  }
}

async function replaceCollection() {
  if (flow.step !== 'confirm-colpkg') return;
  const { name, path } = flow;
  set({ step: 'replacing', name, path });
  try {
    await host.importFile(path, name, true);
    notifyCollectionChanged();
    toast(`'${name}'(으)로 컬렉션을 바꿨습니다`);
    navigate('/decks');
  } catch (err) {
    toast(`가져오기 실패: ${describeError(err).message}`, { kind: 'error' });
  } finally {
    set({ step: 'idle' });
  }
}

function useFlow(): Flow {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => flow,
    () => flow,
  );
}

/** Progress sheet and the .colpkg confirmation. Mount once (App). */
export function ImportFlow() {
  const f = useFlow();
  const busy = f.step === 'uploading' || f.step === 'classifying';
  return (
    <>
      <Sheet open={busy} onClose={() => {}} busy title="가져오는 중" testId="import-progress">
        {busy && (
          <div className="import-progress">
            <p>
              '{f.name}' {f.step === 'uploading' ? '올리는 중' : '확인하는 중'}
              {f.step === 'uploading' && f.fraction !== null ? ` ${Math.round(f.fraction * 100)}%` : ''}
            </p>
            <progress max={1} value={f.step === 'uploading' && f.fraction !== null ? f.fraction : undefined} style={{ width: '100%' }} />
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={f.step === 'confirm-colpkg' || f.step === 'replacing'}
        title="컬렉션 전체 바꾸기"
        danger
        confirmLabel="바꾸기"
        message={
          (f.step === 'confirm-colpkg' || f.step === 'replacing') && (
            <>
              <p data-testid="colpkg-message">'{f.name}' 파일로 이 기기의 컬렉션 전체를 바꿉니다.</p>
              <p className="field__hint">
                지금 있는 모든 덱·카드·학습 기록이 파일의 내용으로 바뀝니다. 바꾸기 전에 지금 컬렉션을 자동으로 백업합니다(설정 › 백업에서 되돌릴 수
                있습니다).
              </p>
            </>
          )
        }
        onConfirm={replaceCollection}
        onClose={() => flow.step === 'confirm-colpkg' && set({ step: 'idle' })}
      />
    </>
  );
}

/** Hidden `<input type=file>`; `pick()` opens the system file chooser. */
export function useImportPicker(): { pick: () => void; input: ReactElement } {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept={IMPORT_ACCEPT}
      hidden
      data-testid="import-input"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (file) void importBlob(file, file.name);
      }}
    />
  );
  return { pick: () => ref.current?.click(), input };
}
