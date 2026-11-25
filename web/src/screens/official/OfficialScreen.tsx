// Screens that embed official Anki pages served by the host.
import { OfficialPage } from '../../ui/OfficialPage';
import { Placeholder } from '../../ui/Placeholder';

/** URL of an official page: `/<page>/<arg>` (arg URL-encoded once). */
export function officialSrc(page: string, arg?: string | number): string {
  if (arg === undefined || arg === '') return `/${page}`;
  return `/${page}/${encodeURIComponent(String(arg))}`;
}

export function OfficialScreen({ title, src }: { title: string; src: string }) {
  return <OfficialPage title={title} src={src} />;
}

/** `#/import/<kind>?path=<host temp path>` from `import.file`. */
export function ImportScreen({ kind, path }: { kind: string; path: string }) {
  if (kind === 'apkg') return <OfficialPage title="덱 가져오기" src={officialSrc('import-anki-package', path)} />;
  if (kind === 'csv') return <OfficialPage title="텍스트/CSV 가져오기" src={officialSrc('import-csv', path)} />;
  if (kind === 'colpkg') return <Placeholder title="컬렉션 가져오기 (.colpkg)" detail={path} />;
  return <OfficialPage title="가져오기" src={officialSrc('import-page', path)} />;
}
