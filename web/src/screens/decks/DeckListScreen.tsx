// `#/decks`: the deck browser. Phone: list + FAB "추가". Wide: list pane +
// overview pane for the selected deck (`?deck=<id>`, default: current deck).
import { useEffect, useRef, useState } from 'react';
import { decks } from '../../anki';
import { dueTotal, findDeck, type DeckRow } from '../../lib/deckTree';
import { useAsync, useWide } from '../../lib/hooks';
import { navigate } from '../../lib/router';
import { usePullToRefresh } from '../../lib/usePullToRefresh';
import { useImportPicker } from '../../lib/importFlow';
import { AddMenu, useCreateDeckDialog } from '../../shell/AddMenu';
import { AppBar } from '../../ui/AppBar';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { IconMore, IconPlus } from '../../ui/icons';
import { Menu, type MenuAnchor } from '../../ui/Menu';
import { LoadingState } from '../../ui/Spinner';
import { EmptyState, ErrorState } from '../../ui/States';
import { SyncButton } from '../../ui/SyncButton';
import { DeckOverview } from '../deck-overview/DeckOverview';
import { DeckList } from './DeckList';
import { useDeckActions } from './useDeckActions';
import { useDeckData } from './useDeckData';
import './DeckListScreen.css';

export function DeckListScreen({ selected }: { selected: number }) {
  const wide = useWide();
  const data = useDeckData();
  const actions = useDeckActions();
  const create = useCreateDeckDialog();
  const importer = useImportPicker();
  const fabRef = useRef<HTMLButtonElement>(null);
  const [addAnchor, setAddAnchor] = useState<MenuAnchor | null>(null);
  const [overflow, setOverflow] = useState<MenuAnchor | null>(null);
  const ptr = usePullToRefresh(data.reload);

  // F5 recomputes counts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        data.reload();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data.reload]);

  // Wide: default selection is the engine's current deck.
  const current = useAsync(async () => (wide && !selected ? (await decks.getCurrentDeck()).id : 0), [wide, selected]);
  const tree = data.data?.tree;
  let selectedId = selected || current.data || 0;
  if (tree && selectedId && !findDeck(tree, selectedId)) selectedId = 0;
  if (tree && !selectedId && wide && tree.children.length) selectedId = tree.children[0].deckId ?? 0;

  const open = (row: DeckRow) => {
    if (wide) navigate(`/decks?deck=${row.id}`, { replace: true });
    else if (dueTotal(row) > 0) navigate(`/study/${row.id}`);
    else navigate(`/deck/${row.id}`);
  };

  let body;
  if (data.error && !data.data) {
    body = <ErrorState error={data.error} title="덱 목록을 불러오지 못했습니다" onRetry={data.reload} />;
  } else if (!data.data) {
    body = <LoadingState />;
  } else if (data.data.tree.children.length === 0) {
    body = (
      <EmptyState
        title="덱이 없습니다"
        message="덱을 가져오거나 새로 만들어 시작하세요."
        actions={
          <>
            <Button onClick={importer.pick}>가져오기</Button>
            <Button variant="primary" onClick={() => create.open()}>
              덱 만들기
            </Button>
          </>
        }
      />
    );
  } else {
    body = (
      <DeckList
        tree={data.data.tree}
        studied={data.data.studied}
        selectedId={wide ? selectedId : undefined}
        onOpen={open}
        onMenu={(row, anchor) => actions.open(row, anchor)}
        onCollapsedChanged={data.reload}
      />
    );
  }

  const appBar = (
    <AppBar
      title="덱"
      actions={
        <>
          <SyncButton />
          <IconButton label="더 보기" onClick={(e) => setOverflow(e.currentTarget.getBoundingClientRect())} data-testid="decks-overflow">
            <IconMore />
          </IconButton>
        </>
      }
    />
  );

  const listPane = (
    <div className="screen deck-screen">
      {appBar}
      <div className="screen__body deck-screen__body" {...(wide ? {} : ptr.handlers)}>
        {!wide && ptr.pull > 0 && (
          <div className="ptr" style={{ height: ptr.pull }} aria-live="polite">
            {ptr.armed ? '놓으면 새로 고침' : '당겨서 새로 고침'}
          </div>
        )}
        {body}
        {!wide && <div className="deck-screen__fab-space" />}
      </div>
      {!wide && (
        <button
          ref={fabRef}
          type="button"
          className="fab"
          aria-label="추가"
          data-testid="fab-add"
          onClick={() => setAddAnchor(fabRef.current!.getBoundingClientRect())}
        >
          <IconPlus />
          <span>추가</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      {wide ? (
        <div className="two-pane">
          <section className="two-pane__list">{listPane}</section>
          <section className="two-pane__detail" aria-label="덱 개요">
            <div className="screen__body">
              {selectedId ? (
                <DeckOverview deckId={selectedId} />
              ) : tree && tree.children.length ? (
                <EmptyState title="덱을 고르세요" />
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        listPane
      )}
      {actions.element}
      {create.dialog}
      {importer.input}
      {!wide && <AddMenu open={!!addAnchor} anchor={addAnchor} onClose={() => setAddAnchor(null)} />}
      <Menu
        open={!!overflow}
        anchor={overflow}
        onClose={() => setOverflow(null)}
        items={[
          { label: '새로 고침', onSelect: data.reload },
          { label: '덱 만들기', onSelect: () => create.open() },
          { label: '노트 유형 관리', onSelect: () => navigate('/notetypes') },
          { label: '설정', onSelect: () => navigate('/settings') },
        ]}
      />
    </>
  );
}
