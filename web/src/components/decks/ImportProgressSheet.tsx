import { useCallback, useRef, useState } from 'react';
import * as host from '../../host';
import { SheetOrDialog } from '../../ui';

export interface ImportProgressState {
  fileName: string;
  size: number;
  stage: 'upload' | 'prepare';
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/** Korean message for a failed upload/import; network errors from fetch are English. */
export function importErrorMessage(err: unknown): string {
  if (err instanceof host.HostApiError && err.message) return err.message;
  if (err instanceof TypeError) {
    return '파일을 올리는 중 연결이 끊어졌습니다. 다시 시도해 주세요.';
  }
  if (err instanceof Error && /[가-힣]/.test(err.message)) return err.message;
  return '파일을 가져오지 못했습니다.';
}

/**
 * Blocking progress sheet shown while a picked file is uploaded to the host and handed
 * to the importer. Large `.apkg` files can take minutes; the menu that started the
 * import has already closed, so this is the only feedback.
 */
export function ImportProgressSheet({ state }: { state: ImportProgressState | null }) {
  const size = state ? formatSize(state.size) : '';
  return (
    <SheetOrDialog
      open={state !== null}
      onClose={() => undefined}
      dismissible={false}
      title={state?.stage === 'prepare' ? '가져오기 준비 중' : '파일 올리는 중'}
      subtitle={state ? `${state.fileName}${size ? ` · ${size}` : ''}` : undefined}
    >
      <div className="amgi-import-progress" role="status" aria-live="polite">
        <span className="amgi-import-progress-bar" aria-hidden="true">
          <span className="amgi-import-progress-bar-fill" />
        </span>
        <p className="amgi-prose" style={{ margin: 0 }}>
          {state?.stage === 'prepare'
            ? '파일 내용을 확인하고 있습니다.'
            : '파일을 앱으로 옮기고 있습니다. 큰 파일은 몇 분 걸릴 수 있으니 화면을 닫지 마세요.'}
        </p>
      </div>
    </SheetOrDialog>
  );
}

export type ImportFileOutcome =
  | { kind: 'route'; route: string }
  | { kind: 'colpkgConfirm'; path: string; name: string }
  | { kind: 'none' };

/**
 * Uploads `file` and asks the host how to import it, with a progress state for
 * `ImportProgressSheet`. Throws on failure (use `importErrorMessage`).
 */
export function useFileImport() {
  const [progress, setProgress] = useState<ImportProgressState | null>(null);
  const busyRef = useRef(false);

  const run = useCallback(async (file: File): Promise<ImportFileOutcome> => {
    if (busyRef.current) return { kind: 'none' };
    busyRef.current = true;
    setProgress({ fileName: file.name, size: file.size, stage: 'upload' });
    try {
      const uploaded = await host.uploadHostFile(file, file.name);
      setProgress({ fileName: file.name, size: file.size, stage: 'prepare' });
      const res = await host.host.importFile({ path: uploaded.path, name: file.name });
      if (res.kind === 'colpkg' && res.needsConfirm) {
        return { kind: 'colpkgConfirm', path: res.path, name: file.name };
      }
      if (res.route) return { kind: 'route', route: res.route };
      if (res.kind === 'apkg') {
        return { kind: 'route', route: `/import-anki-package/${encodeURIComponent(res.path)}` };
      }
      if (res.kind === 'csv') {
        return { kind: 'route', route: `/import-csv/${encodeURIComponent(res.path)}` };
      }
      return { kind: 'none' };
    } finally {
      busyRef.current = false;
      setProgress(null);
    }
  }, []);

  return { progress, busy: progress !== null, run };
}
