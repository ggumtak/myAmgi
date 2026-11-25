import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppSettings,
  Card,
  DEFAULT_SETTINGS,
  Deck,
  Ease,
  Note,
  NoteType,
  Revlog,
} from './types/models';
import { dbStore, ensureStarterCollection } from './db/store';
import {
  ReviewResult,
  applyReview,
  buildStudyQueue,
  computeDeckCounts,
} from './engine/scheduler';
import { importApkgFile } from './importers/apkg';
import { DeckList } from './components/DeckList';
import { StudyView } from './components/StudyView';
import { LargeTemplateEditor } from './components/LargeTemplateEditor';
import { Heatmap } from './components/Heatmap';
import { ImportView } from './components/ImportView';
import { SettingsView } from './components/SettingsView';

type Tab = 'decks' | 'study' | 'editor' | 'import' | 'stats' | 'settings';

export function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('decks');

  const [decks, setDecks] = useState<Deck[]>([]);
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [revlogs, setRevlogs] = useState<Revlog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [studyDeckId, setStudyDeckId] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<ReviewResult[]>([]);

  const reloadAll = useCallback(async () => {
    await ensureStarterCollection();
    const [d, nt, n, c, r, s] = await Promise.all([
      dbStore.getAllDecks(),
      dbStore.getAllNoteTypes(),
      dbStore.getAllNotes(),
      dbStore.getAllCards(),
      dbStore.getAllRevlogs(),
      dbStore.getSettings(),
    ]);
    setDecks(d);
    setNoteTypes(nt);
    setNotes(n);
    setCards(c);
    setRevlogs(r);
    setSettings(s);
  }, []);

  useEffect(() => {
    void reloadAll().finally(() => setLoading(false));
  }, [reloadAll]);

  // Apply html.night_mode class for Anki compatibility & app dark theme
  useEffect(() => {
    const applyNightClass = () => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isNight =
        settings.nightMode === 'dark' ||
        (settings.nightMode === 'auto' && prefersDark);
      document.documentElement.classList.toggle('night_mode', isNight);
    };

    applyNightClass();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', applyNightClass);
    return () => mq?.removeEventListener?.('change', applyNightClass);
  }, [settings.nightMode]);

  const notesById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);
  const noteTypesById = useMemo(
    () => new Map(noteTypes.map((nt) => [nt.id, nt])),
    [noteTypes]
  );

  const deckCounts = useMemo(
    () =>
      computeDeckCounts(
        decks,
        cards,
        revlogs,
        Date.now(),
        settings.collectionCreatedAt
      ),
    [decks, cards, revlogs, settings.collectionCreatedAt]
  );

  const studyDeck = useMemo(
    () => decks.find((d) => d.id === studyDeckId) ?? null,
    [decks, studyDeckId]
  );

  const studyQueue = useMemo(() => {
    if (!studyDeckId) return [];
    return buildStudyQueue(
      decks,
      cards,
      revlogs,
      studyDeckId,
      Date.now(),
      settings.collectionCreatedAt
    );
  }, [decks, cards, revlogs, studyDeckId, settings.collectionCreatedAt]);

  const handleStartStudy = (deckId: number) => {
    setStudyDeckId(deckId);
    setActiveTab('study');
  };

  const handleAnswer = async (card: Card, ease: Ease, elapsedMs: number) => {
    const deck = decks.find((d) => d.id === card.did) ?? studyDeck ?? undefined;
    const res = applyReview(card, deck, ease, elapsedMs);
    await Promise.all([
      dbStore.putCard(res.updatedCard),
      dbStore.putRevlog(res.revlog),
    ]);
    setCards((prev) =>
      prev.map((c) => (c.id === res.updatedCard.id ? res.updatedCard : c))
    );
    setRevlogs((prev) => [...prev, res.revlog]);
    setUndoStack((prev) => [...prev.slice(-29), res]);
  };

  const handleUndo = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    await Promise.all([
      dbStore.putCard(last.previousCard),
      dbStore.deleteRevlog(last.revlog.id),
    ]);
    setCards((prev) =>
      prev.map((c) => (c.id === last.previousCard.id ? last.previousCard : c))
    );
    setRevlogs((prev) => prev.filter((r) => r.id !== last.revlog.id));
    setUndoStack((prev) => prev.slice(0, -1));
  };

  const handleCreateDeck = async (name: string) => {
    const now = Date.now();
    const parts = name.split('::').filter(Boolean);
    const createdDecks: Deck[] = [];
    for (let i = 1; i <= parts.length; i++) {
      const subName = parts.slice(0, i).join('::');
      if (decks.some((d) => d.name === subName)) continue;
      createdDecks.push({
        id: now + i,
        name: subName,
        parent: i > 1 ? parts.slice(0, i - 1).join('::') : undefined,
        configId: 1,
        collapsed: false,
        newPerDay: 20,
        revPerDay: 200,
        fsrsEnabled: true,
        desiredRetention: 0.9,
        mod: Math.floor(now / 1000),
      });
    }
    if (createdDecks.length > 0) {
      await dbStore.putDecks(createdDecks);
      setDecks((prev) => [...prev, ...createdDecks]);
    }
  };

  const handleToggleCollapse = async (deck: Deck) => {
    const updated: Deck = {
      ...deck,
      collapsed: !deck.collapsed,
      mod: Math.floor(Date.now() / 1000),
    };
    await dbStore.putDeck(updated);
    setDecks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleToggleDeckFsrs = async (deck: Deck) => {
    const updated: Deck = {
      ...deck,
      fsrsEnabled: !deck.fsrsEnabled,
      mod: Math.floor(Date.now() / 1000),
    };
    await dbStore.putDeck(updated);
    setDecks((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleAddCard = async (
    deckId: number,
    noteTypeId: number,
    fields: string[]
  ) => {
    const now = Date.now();
    const nt = noteTypes.find((n) => n.id === noteTypeId);
    const noteId = now;
    const mod = Math.floor(now / 1000);
    const newNote: Note = {
      id: noteId,
      guid: `amgi-${now}-${Math.random().toString(36).slice(2, 8)}`,
      mid: noteTypeId,
      flds: fields,
      tags: [],
      mod,
    };

    const newCards: Card[] = [];
    if (nt?.kind === 1) {
      // Cloze note: detect c1, c2, ...
      const text = fields.join(' ');
      const matches = Array.from(text.matchAll(/\{\{c(\d+)::/g));
      const ords = Array.from(
        new Set(matches.map((m) => Math.max(0, Number(m[1]) - 1)))
      );
      if (ords.length === 0) ords.push(0);
      ords.forEach((ord, idx) => {
        newCards.push({
          id: now + idx + 1,
          nid: noteId,
          did: deckId,
          ord,
          queue: 0,
          type: 0,
          due: now + idx,
          ivl: 0,
          factor: 2500,
          reps: 0,
          lapses: 0,
          data: {},
          mod,
        });
      });
    } else {
      const tmpls = nt?.templates ?? [{ ord: 0, name: 'Card 1', qfmt: '', afmt: '' }];
      tmpls.forEach((t, idx) => {
        newCards.push({
          id: now + idx + 1,
          nid: noteId,
          did: deckId,
          ord: t.ord,
          queue: 0,
          type: 0,
          due: now + idx,
          ivl: 0,
          factor: 2500,
          reps: 0,
          lapses: 0,
          data: {},
          mod,
        });
      });
    }

    await Promise.all([dbStore.putNote(newNote), dbStore.putCards(newCards)]);
    setNotes((prev) => [...prev, newNote]);
    setCards((prev) => [...prev, ...newCards]);
  };

  const handleSaveNoteType = async (updated: NoteType) => {
    await dbStore.putNoteType(updated);
    setNoteTypes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  const handleImportApkgComplete = async (
    result: Awaited<ReturnType<typeof importApkgFile>>
  ) => {
    await Promise.all([
      dbStore.putDecks(result.decks),
      dbStore.putNoteTypes(result.noteTypes),
      dbStore.putNotes(result.notes),
      dbStore.putCards(result.cards),
      dbStore.putRevlogs(result.revlogs),
      dbStore.putMediaMany(result.media),
      dbStore.saveSettings({ collectionCreatedAt: result.collectionCreatedAt }),
    ]);
    await reloadAll();
  };

  const handleImportCsvComplete = async (
    deckId: number,
    noteTypeId: number,
    rows: string[][]
  ) => {
    const base = Date.now();
    const mod = Math.floor(base / 1000);
    const newNotes: Note[] = [];
    const newCards: Card[] = [];

    rows.forEach((row, idx) => {
      const nid = base + idx * 10;
      const cid = nid + 1;
      newNotes.push({
        id: nid,
        guid: `csv-${nid}`,
        mid: noteTypeId,
        flds: row,
        tags: ['csv-import'],
        mod,
      });
      newCards.push({
        id: cid,
        nid,
        did: deckId,
        ord: 0,
        queue: 0,
        type: 0,
        due: idx,
        ivl: 0,
        factor: 2500,
        reps: 0,
        lapses: 0,
        data: {},
        mod,
      });
    });

    await Promise.all([dbStore.putNotes(newNotes), dbStore.putCards(newCards)]);
    setNotes((prev) => [...prev, ...newNotes]);
    setCards((prev) => [...prev, ...newCards]);
  };

  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    const next = await dbStore.saveSettings(partial);
    setSettings(next);
    return next;
  };

  const handleResetCollection = async () => {
    await dbStore.clearAllData();
    setUndoStack([]);
    setStudyDeckId(null);
    await reloadAll();
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <p>myAmgi 로컬 데이터베이스 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => setActiveTab('decks')}>
          <span className="brand-logo">암</span>
          <div>
            <div className="brand-title">myAmgi</div>
            <div className="brand-sub">Anki + FSRS-5 Offline PWA</div>
          </div>
        </div>

        <nav className="nav-tabs" aria-label="주 메뉴">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'decks' ? 'active' : ''}`}
            onClick={() => setActiveTab('decks')}
          >
            📚 덱 목록
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'study' ? 'active' : ''}`}
            onClick={() => {
              if (!studyDeckId && decks[0]) setStudyDeckId(decks[0].id);
              setActiveTab('study');
            }}
          >
            ⚡ 학습
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            🧩 템플릿 에디터
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            📥 가져오기
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            🟩 학습 잔디
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ 설정 / 동기화
          </button>
        </nav>
      </header>

      <main className="main-content">
        {activeTab === 'decks' && (
          <>
            <DeckList
              decks={decks}
              counts={deckCounts}
              cards={cards}
              notes={notes}
              noteTypes={noteTypes}
              onStartStudy={handleStartStudy}
              onCreateDeck={handleCreateDeck}
              onToggleCollapse={handleToggleCollapse}
              onAddCard={handleAddCard}
              onToggleDeckFsrs={handleToggleDeckFsrs}
            />
            <div style={{ marginTop: 20 }}>
              <Heatmap revlogs={revlogs} />
            </div>
          </>
        )}

        {activeTab === 'study' && studyDeck && (
          <StudyView
            deck={studyDeck}
            queue={studyQueue}
            notesById={notesById}
            noteTypesById={noteTypesById}
            settings={settings}
            canUndo={undoStack.length > 0}
            onAnswer={handleAnswer}
            onUndo={handleUndo}
            onExit={() => setActiveTab('decks')}
          />
        )}

        {activeTab === 'editor' && (
          <LargeTemplateEditor
            noteTypes={noteTypes}
            onSaveNoteType={handleSaveNoteType}
          />
        )}

        {activeTab === 'import' && (
          <ImportView
            decks={decks}
            noteTypes={noteTypes}
            onImportApkgComplete={handleImportApkgComplete}
            onImportCsvComplete={handleImportCsvComplete}
          />
        )}

        {activeTab === 'stats' && <Heatmap revlogs={revlogs} />}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onSyncComplete={reloadAll}
            onResetCollection={handleResetCollection}
          />
        )}
      </main>
    </div>
  );
}

export default App;
