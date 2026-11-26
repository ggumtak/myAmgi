// Screens that embed official Anki pages served by the host (ui/OfficialPage).
import { goBack } from '../../lib/back';
import { notifyCollectionChanged } from '../../lib/hooks';
import { OfficialPage } from '../../ui/OfficialPage';
import { EmptyState } from '../../ui/States';
import { toast } from '../../ui/Toast';

/** URL of an official page: `/<page>/<arg>` (arg URL-encoded once). */
export function officialSrc(page: string, arg?: string | number): string {
  if (arg === undefined || arg === '') return `/${page}`;
  return `/${page}/${encodeURIComponent(String(arg))}`;
}

export function OfficialScreen({ title, src }: { title: string; src: string }) {
  return <OfficialPage title={title} src={src} />;
}

/**
 * `#/deck-options/:id`. Anki closes the page after a successful save (the host sends
 * `anki-page {method: updateDeckConfigs, close: true}`): back to where we came from,
 * with a toast and fresh counts.
 */
export function DeckOptionsScreen({ deckId }: { deckId: string }) {
  return (
    <OfficialPage
      title="덱 옵션"
      src={officialSrc('deck-options', deckId)}
      onClose={(ev) => {
        if (ev.method === 'updateDeckConfigs') {
          toast('저장했습니다');
          notifyCollectionChanged();
        }
        goBack();
      }}
    />
  );
}

const IMPORT_TITLES: Record<string, string> = { apkg: '덱 가져오기', csv: '텍스트/CSV 가져오기' };

/**
 * `#/import/<kind>?route=<official page path from import.file>`: the official import page
 * (options, then the import log). The collection changed once it reports `importDone`.
 */
export function ImportScreen({ kind, route }: { kind: string; route: string }) {
  if (!/^\/import-(anki-package|csv|page)\//.test(route)) {
    return <EmptyState title="가져올 파일이 없습니다" message="추가 › 가져오기에서 파일을 고르세요." />;
  }
  return (
    <OfficialPage
      title={IMPORT_TITLES[kind] ?? '가져오기'}
      src={route}
      onAnkiEvent={(ev) => {
        if (ev.method === 'importDone') {
          notifyCollectionChanged();
          toast('가져오기 완료');
        }
      }}
    />
  );
}
