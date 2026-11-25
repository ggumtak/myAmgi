// Every route of docs/UI_SPEC.md. Screens not built yet render a placeholder
// that names the screen; each screen lives in its own folder under screens/.
import type { ReactNode } from 'react';
import { compile, matchPath, type Location } from './lib/router';
import { DeckListScreen } from './screens/decks/DeckListScreen';
import { DeckOverviewScreen } from './screens/deck-overview/DeckOverviewScreen';
import { StudyScreen } from './screens/study/StudyScreen';
import { BrowseScreen } from './screens/browse/BrowseScreen';
import { NoteEditorScreen } from './screens/note-editor/NoteEditorScreen';
import { NotetypeScreen, NotetypesScreen } from './screens/notetypes/NotetypesScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { DeckOptionsScreen, ImportScreen, OfficialScreen, officialSrc } from './screens/official/OfficialScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { AboutScreen } from './screens/settings/AboutScreen';
import { SyncSettingsScreen } from './screens/settings/SyncSettingsScreen';
import { BackupScreen } from './screens/settings/BackupScreen';
import { ToolsScreen } from './screens/settings/ToolsScreen';
import { CustomStudyScreen } from './screens/custom-study/CustomStudyScreen';
import { FilteredDeckScreen } from './screens/filtered-deck/FilteredDeckScreen';
import { ExportScreen } from './screens/export/ExportScreen';

export type Tab = 'decks' | 'browse' | 'stats' | 'settings';

export interface RouteContext {
  params: Record<string, string>;
  query: URLSearchParams;
  location: Location;
}

export interface RouteDef {
  pattern: string;
  /** Screen name (used by tests and placeholders). */
  name: string;
  tab?: Tab;
  /** false = no tab bar / rail (reviewer). */
  chrome?: boolean;
  render: (ctx: RouteContext) => ReactNode;
}

const num = (s: string | undefined) => Number(s ?? '0') || 0;

export const routes: RouteDef[] = [
  { pattern: '/decks', name: 'decks', tab: 'decks', render: ({ query }) => <DeckListScreen selected={num(query.get('deck') ?? undefined)} /> },
  { pattern: '/deck/:id', name: 'deck-overview', tab: 'decks', render: ({ params }) => <DeckOverviewScreen deckId={num(params.id)} /> },
  { pattern: '/study/:id', name: 'study', chrome: false, render: ({ params }) => <StudyScreen deckId={num(params.id)} /> },
  { pattern: '/browse', name: 'browse', tab: 'browse', render: ({ query }) => <BrowseScreen query={query.get('q') ?? ''} /> },
  { pattern: '/note/new', name: 'note-add', tab: 'browse', render: ({ query }) => <NoteEditorScreen mode="add" deckId={num(query.get('deck') ?? undefined)} /> },
  { pattern: '/note/:id', name: 'note-edit', tab: 'browse', render: ({ params }) => <NoteEditorScreen mode="edit" noteId={num(params.id)} /> },
  { pattern: '/notetypes', name: 'notetypes', tab: 'settings', render: () => <NotetypesScreen /> },
  { pattern: '/notetype/:id', name: 'notetype', tab: 'settings', render: ({ params }) => <NotetypeScreen notetypeId={num(params.id)} /> },
  { pattern: '/stats', name: 'stats', tab: 'stats', render: () => <StatsScreen /> },
  { pattern: '/deck-options/:id', name: 'deck-options', tab: 'decks', render: ({ params }) => <DeckOptionsScreen deckId={params.id} /> },
  { pattern: '/card-info/:id', name: 'card-info', tab: 'browse', render: ({ params }) => <OfficialScreen title="카드 정보" src={officialSrc('card-info', params.id)} /> },
  { pattern: '/congrats', name: 'congrats', tab: 'decks', render: () => <OfficialScreen title="축하합니다" src={officialSrc('congrats')} /> },
  {
    pattern: '/import/:kind',
    name: 'import',
    tab: 'decks',
    render: ({ params, query }) => <ImportScreen kind={params.kind} route={query.get('route') ?? ''} />,
  },
  { pattern: '/change-notetype/*', name: 'change-notetype', tab: 'browse', render: ({ params }) => <OfficialScreen title="노트 유형 변경" src={officialSrc('change-notetype', params['*'])} /> },
  { pattern: '/image-occlusion/*', name: 'image-occlusion', tab: 'browse', render: ({ params }) => <OfficialScreen title="이미지 가림" src={officialSrc('image-occlusion', params['*'])} /> },
  { pattern: '/custom-study/:id', name: 'custom-study', tab: 'decks', render: ({ params }) => <CustomStudyScreen deckId={num(params.id)} /> },
  { pattern: '/filtered-deck/:id', name: 'filtered-deck', tab: 'decks', render: ({ params }) => <FilteredDeckScreen deckId={params.id} /> },
  { pattern: '/export', name: 'export', tab: 'decks', render: ({ query }) => <ExportScreen deckId={num(query.get('deck') ?? undefined)} /> },
  { pattern: '/settings', name: 'settings', tab: 'settings', render: () => <SettingsScreen /> },
  { pattern: '/settings/sync', name: 'settings-sync', tab: 'settings', render: () => <SyncSettingsScreen /> },
  { pattern: '/settings/backup', name: 'settings-backup', tab: 'settings', render: () => <BackupScreen /> },
  { pattern: '/settings/about', name: 'settings-about', tab: 'settings', render: () => <AboutScreen /> },
  { pattern: '/settings/tools', name: 'settings-tools', tab: 'settings', render: () => <ToolsScreen /> },
];

const compiled = compile(routes);

export const NOT_FOUND: RouteDef = {
  pattern: '*',
  name: 'not-found',
  render: () => null,
};

export function resolveRoute(path: string): { route: RouteDef; params: Record<string, string> } {
  if (path === '/' || path === '') return { route: routes[0], params: {} };
  return matchPath(compiled, path) ?? { route: NOT_FOUND, params: {} };
}
