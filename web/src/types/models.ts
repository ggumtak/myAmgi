export type NightMode = 'light' | 'dark' | 'auto';

export type Ease = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy

export type CardQueue = 0 | 1 | 2 | 3 | -1; // 0=new, 1=learn, 2=review, 3=day-learn, -1=suspended
export type CardType = 0 | 1 | 2 | 3; // 0=new, 1=learn, 2=review, 3=relearn

export interface Deck {
  id: number;
  name: string; // Hierarchical via '::'
  parent?: string;
  configId: number;
  collapsed: boolean;
  newPerDay: number;
  revPerDay: number;
  fsrsEnabled: boolean;
  desiredRetention: number;
  fsrsParams?: number[];
  mod?: number;
}

export interface NoteTypeTemplate {
  ord: number;
  name: string;
  qfmt: string;
  afmt: string;
}

export interface NoteType {
  id: number;
  name: string;
  fields: string[];
  templates: NoteTypeTemplate[];
  css: string;
  kind: 0 | 1; // 0 = standard, 1 = cloze
  mod?: number;
}

export interface Note {
  id: number;
  guid: string;
  mid: number;
  flds: string[];
  tags: string[];
  mod: number;
}

export interface CardFsrsData {
  s?: number; // stability
  d?: number; // difficulty
  dr?: number; // desired retention override
  fsrs?: boolean;
  l?: number; // step / left
  [key: string]: unknown;
}

export interface Card {
  id: number;
  nid: number;
  did: number;
  ord: number;
  queue: CardQueue;
  type: CardType;
  due: number; // review: day number (epoch days or collection-relative); learn: timestamp ms/s; new: position
  ivl: number; // days (or negative seconds for learning in Anki)
  factor: number; // SM-2 ease * 1000 (e.g. 2500)
  reps: number;
  lapses: number;
  data: CardFsrsData;
  mod: number;
}

export interface Revlog {
  id: number; // timestamp ms
  cid: number;
  ease: Ease;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number; // ms spent
  type: number; // 0=learn, 1=review, 2=relearn, 3=cram
}

export interface MediaItem {
  name: string;
  bytes: Uint8Array;
  mime: string;
  sha256: string;
  remoteUrl?: string;
}

export interface AppSettings {
  id: 'app';
  twoButtonMode: boolean; // default TRUE
  nightMode: NightMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseEmail: string;
  supabaseAccessToken: string;
  supabaseRefreshToken: string;
  supabaseUserId: string;
  syncCode: string;
  lastSyncAt?: number;
  collectionCreatedAt: number; // ms timestamp
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  twoButtonMode: true,
  nightMode: 'auto',
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseEmail: '',
  supabaseAccessToken: '',
  supabaseRefreshToken: '',
  supabaseUserId: '',
  syncCode: '',
  lastSyncAt: 0,
  collectionCreatedAt: Date.now(),
};
