import {
  AppSettings,
  Card,
  DEFAULT_SETTINGS,
  Deck,
  MediaItem,
  Note,
  NoteType,
  Revlog,
} from '../types/models';

const DB_NAME = 'myamgi_db';
const DB_VERSION = 1;

export type StoreName =
  | 'decks'
  | 'notetypes'
  | 'notes'
  | 'cards'
  | 'revlogs'
  | 'media'
  | 'settings';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('decks')) {
        db.createObjectStore('decks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notetypes')) {
        db.createObjectStore('notetypes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        const s = db.createObjectStore('notes', { keyPath: 'id' });
        s.createIndex('mid', 'mid', { unique: false });
      }
      if (!db.objectStoreNames.contains('cards')) {
        const s = db.createObjectStore('cards', { keyPath: 'id' });
        s.createIndex('did', 'did', { unique: false });
        s.createIndex('nid', 'nid', { unique: false });
        s.createIndex('queue', 'queue', { unique: false });
      }
      if (!db.objectStoreNames.contains('revlogs')) {
        const s = db.createObjectStore('revlogs', { keyPath: 'id' });
        s.createIndex('cid', 'cid', { unique: false });
      }
      if (!db.objectStoreNames.contains('media')) {
        const s = db.createObjectStore('media', { keyPath: 'name' });
        s.createIndex('sha256', 'sha256', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  const res = await reqToPromise<T[]>(tx.objectStore(storeName).getAll());
  return res ?? [];
}

async function getOne<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readonly');
  return reqToPromise<T | undefined>(tx.objectStore(storeName).get(key));
}

async function putOne<T>(storeName: StoreName, item: T): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(item);
  await txDone(tx);
}

async function putMany<T>(storeName: StoreName, items: T[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const item of items) {
    store.put(item);
  }
  await txDone(tx);
}

async function deleteOne(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await txDone(tx);
}

async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).clear();
  await txDone(tx);
}

export const dbStore = {
  // Decks
  getAllDecks: () => getAll<Deck>('decks'),
  getDeck: (id: number) => getOne<Deck>('decks', id),
  putDeck: (deck: Deck) => putOne('decks', deck),
  putDecks: (decks: Deck[]) => putMany('decks', decks),
  deleteDeck: (id: number) => deleteOne('decks', id),

  // NoteTypes
  getAllNoteTypes: () => getAll<NoteType>('notetypes'),
  getNoteType: (id: number) => getOne<NoteType>('notetypes', id),
  putNoteType: (nt: NoteType) => putOne('notetypes', nt),
  putNoteTypes: (nts: NoteType[]) => putMany('notetypes', nts),
  deleteNoteType: (id: number) => deleteOne('notetypes', id),

  // Notes
  getAllNotes: () => getAll<Note>('notes'),
  getNote: (id: number) => getOne<Note>('notes', id),
  putNote: (note: Note) => putOne('notes', note),
  putNotes: (notes: Note[]) => putMany('notes', notes),
  deleteNote: (id: number) => deleteOne('notes', id),

  // Cards
  getAllCards: () => getAll<Card>('cards'),
  getCard: (id: number) => getOne<Card>('cards', id),
  putCard: (card: Card) => putOne('cards', card),
  putCards: (cards: Card[]) => putMany('cards', cards),
  deleteCard: (id: number) => deleteOne('cards', id),

  // Revlogs
  getAllRevlogs: () => getAll<Revlog>('revlogs'),
  putRevlog: (revlog: Revlog) => putOne('revlogs', revlog),
  putRevlogs: (revlogs: Revlog[]) => putMany('revlogs', revlogs),
  deleteRevlog: (id: number) => deleteOne('revlogs', id),

  // Media
  getAllMedia: () => getAll<MediaItem>('media'),
  getMedia: (name: string) => getOne<MediaItem>('media', name),
  putMedia: (item: MediaItem) => putOne('media', item),
  putMediaMany: (items: MediaItem[]) => putMany('media', items),

  // Settings
  async getSettings(): Promise<AppSettings> {
    const existing = await getOne<AppSettings>('settings', 'app');
    if (!existing) {
      const fresh: AppSettings = { ...DEFAULT_SETTINGS, collectionCreatedAt: Date.now() };
      await putOne('settings', fresh);
      return fresh;
    }
    return { ...DEFAULT_SETTINGS, ...existing };
  },
  async saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const next: AppSettings = { ...current, ...partial, id: 'app' };
    await putOne('settings', next);
    return next;
  },

  async clearAllData(): Promise<void> {
    await Promise.all([
      clearStore('decks'),
      clearStore('notetypes'),
      clearStore('notes'),
      clearStore('cards'),
      clearStore('revlogs'),
      clearStore('media'),
    ]);
  },
};

export async function ensureStarterCollection(): Promise<boolean> {
  const decks = await dbStore.getAllDecks();
  if (decks.length > 0) return false;

  const now = Date.now();
  const defaultDeck: Deck = {
    id: 1,
    name: 'Default',
    configId: 1,
    collapsed: false,
    newPerDay: 20,
    revPerDay: 200,
    fsrsEnabled: true,
    desiredRetention: 0.9,
    mod: Math.floor(now / 1000),
  };

  const basicNoteType: NoteType = {
    id: 1700000000001,
    name: 'Basic (myAmgi)',
    fields: ['Front', 'Back'],
    templates: [
      {
        ord: 0,
        name: 'Card 1',
        qfmt: '<div class="front">{{Front}}</div>',
        afmt: '{{FrontSide}}<hr id="answer"><div class="back">{{Back}}</div>',
      },
    ],
    css: `.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 22px;
  text-align: center;
  color: #1f2937;
  background-color: transparent;
  padding: 20px;
}
.night_mode .card {
  color: #f3f4f6;
}`,
    kind: 0,
    mod: Math.floor(now / 1000),
  };

  const clozeNoteType: NoteType = {
    id: 1700000000002,
    name: 'Cloze (myAmgi)',
    fields: ['Text', 'Extra'],
    templates: [
      {
        ord: 0,
        name: 'Cloze',
        qfmt: '{{cloze:Text}}',
        afmt: '{{cloze:Text}}<br><div class="extra">{{Extra}}</div>',
      },
    ],
    css: `.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 22px;
  text-align: center;
  color: #1f2937;
  padding: 20px;
}
.cloze {
  font-weight: 700;
  color: #2563eb;
}
.night_mode .card { color: #f3f4f6; }
.night_mode .cloze { color: #60a5fa; }`,
    kind: 1,
    mod: Math.floor(now / 1000),
  };

  await dbStore.putDeck(defaultDeck);
  await dbStore.putNoteTypes([basicNoteType, clozeNoteType]);
  return true;
}
