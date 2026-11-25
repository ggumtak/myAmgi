import { dbStore } from '../db/store';
import { AppSettings, Card, Deck, MediaItem, Note, NoteType, Revlog } from '../types/models';
import { encodeSyncCode } from './syncCode';

export interface SupabaseAuthSession {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string;
  };
}

export interface SyncProgress {
  phase: string;
  detail: string;
}

export interface SyncReport {
  pushedItems: number;
  pulledItems: number;
  uploadedMedia: number;
  syncedAt: number;
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function authHeaders(anonKey: string, accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: anonKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

export async function signInWithPassword(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string
): Promise<SupabaseAuthSession> {
  const url = `${normalizeUrl(supabaseUrl)}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(anonKey),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase 로그인 실패 (${res.status}): ${errText}`);
  }
  return (await res.json()) as SupabaseAuthSession;
}

export async function signUpWithPassword(
  supabaseUrl: string,
  anonKey: string,
  email: string,
  password: string
): Promise<SupabaseAuthSession> {
  const url = `${normalizeUrl(supabaseUrl)}/auth/v1/signup`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(anonKey),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase 회원가입 실패 (${res.status}): ${errText}`);
  }
  return (await res.json()) as SupabaseAuthSession;
}

export async function refreshSupabaseSession(
  supabaseUrl: string,
  anonKey: string,
  refreshToken: string
): Promise<SupabaseAuthSession> {
  const url = `${normalizeUrl(supabaseUrl)}/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(anonKey),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`세션 갱신 실패 (${res.status}): ${errText}`);
  }
  return (await res.json()) as SupabaseAuthSession;
}

export async function fetchSupabaseUser(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string
): Promise<{ id: string; email?: string }> {
  const url = `${normalizeUrl(supabaseUrl)}/auth/v1/user`;
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(anonKey, accessToken),
  });
  if (!res.ok) {
    throw new Error(`사용자 정보 조회 실패 (${res.status})`);
  }
  return (await res.json()) as { id: string; email?: string };
}

async function ensureValidSession(settings: AppSettings): Promise<AppSettings> {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    throw new Error('Supabase URL과 Anon Key를 먼저 설정하세요.');
  }

  // Try refresh if refreshToken is present and accessToken missing or likely expired
  if (settings.supabaseRefreshToken) {
    try {
      const session = await refreshSupabaseSession(
        settings.supabaseUrl,
        settings.supabaseAnonKey,
        settings.supabaseRefreshToken
      );
      const syncCode = encodeSyncCode({
        supabaseUrl: settings.supabaseUrl,
        supabaseAnonKey: settings.supabaseAnonKey,
        email: session.user?.email ?? settings.supabaseEmail,
        refreshToken: session.refresh_token,
        accessToken: session.access_token,
      });
      return await dbStore.saveSettings({
        supabaseAccessToken: session.access_token,
        supabaseRefreshToken: session.refresh_token,
        supabaseUserId: session.user?.id ?? settings.supabaseUserId,
        supabaseEmail: session.user?.email ?? settings.supabaseEmail,
        syncCode,
      });
    } catch {
      // Fall back to existing access token if still valid
    }
  }

  if (!settings.supabaseAccessToken) {
    throw new Error('Supabase 로그인이 필요합니다.');
  }

  if (!settings.supabaseUserId) {
    const user = await fetchSupabaseUser(
      settings.supabaseUrl,
      settings.supabaseAnonKey,
      settings.supabaseAccessToken
    );
    return await dbStore.saveSettings({
      supabaseUserId: user.id,
      supabaseEmail: user.email ?? settings.supabaseEmail,
    });
  }

  return settings;
}

interface RemoteSyncItemRow {
  user_id: string;
  item_type: 'deck' | 'notetype' | 'note' | 'card' | 'revlog';
  item_id: string;
  payload: unknown;
  updated_at: number;
}

interface RemoteUserSettingsRow {
  user_id: string;
  two_button_mode?: boolean;
  night_mode?: string;
  updated_at?: number;
}

async function upsertRestRows(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  table: string,
  rows: unknown[],
  onConflict: string
): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK_SIZE = 200;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const batch = rows.slice(i, i + CHUNK_SIZE);
    const url = `${normalizeUrl(supabaseUrl)}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders(anonKey, accessToken),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`Supabase ${table} 업로드 실패 (${res.status}): ${msg}`);
    }
  }
}

async function selectRestRows<T>(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string,
  table: string,
  query: string
): Promise<T[]> {
  const url = `${normalizeUrl(supabaseUrl)}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(anonKey, accessToken),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Supabase ${table} 조회 실패 (${res.status}): ${msg}`);
  }
  return (await res.json()) as T[];
}

export async function uploadMediaObject(
  settings: AppSettings,
  item: MediaItem
): Promise<string> {
  const baseUrl = normalizeUrl(settings.supabaseUrl);
  const objectPath = `${settings.supabaseUserId}/${item.sha256}`;
  const url = `${baseUrl}/storage/v1/object/amgi-media/${objectPath}`;

  const copy = new Uint8Array(item.bytes);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: settings.supabaseAnonKey,
      Authorization: `Bearer ${settings.supabaseAccessToken}`,
      'Content-Type': item.mime || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: copy.buffer,
  });

  if (!res.ok && res.status !== 409) {
    const err = await res.text();
    throw new Error(`미디어 업로드 실패 (${item.name}): ${err}`);
  }

  return `${baseUrl}/storage/v1/object/authenticated/amgi-media/${objectPath}`;
}

/**
 * On-demand download of a media file from Supabase Storage (`amgi-media/{user_id}/{sha256}`)
 */
export async function downloadMediaOnDemand(
  settings: AppSettings,
  sha256: string,
  fileName: string,
  mime = 'application/octet-stream'
): Promise<MediaItem | null> {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey || !settings.supabaseAccessToken || !settings.supabaseUserId) {
    return null;
  }
  const baseUrl = normalizeUrl(settings.supabaseUrl);
  const objectPath = `${settings.supabaseUserId}/${sha256}`;
  const url = `${baseUrl}/storage/v1/object/authenticated/amgi-media/${objectPath}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: settings.supabaseAnonKey,
      Authorization: `Bearer ${settings.supabaseAccessToken}`,
    },
  });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const item: MediaItem = {
    name: fileName,
    bytes: new Uint8Array(buf),
    mime: res.headers.get('content-type') || mime,
    sha256,
    remoteUrl: url,
  };
  await dbStore.putMedia(item);
  return item;
}

export async function syncWithSupabase(
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncReport> {
  onProgress?.({ phase: 'auth', detail: '세션 확인 중...' });
  const initialSettings = await dbStore.getSettings();
  const settings = await ensureValidSession(initialSettings);
  const userId = settings.supabaseUserId;
  const nowSec = Math.floor(Date.now() / 1000);

  // 1. Sync user settings (amgi_user_settings)
  onProgress?.({ phase: 'settings', detail: '사용자 설정 동기화 중...' });
  const remoteSettingsRows = await selectRestRows<RemoteUserSettingsRow>(
    settings.supabaseUrl,
    settings.supabaseAnonKey,
    settings.supabaseAccessToken,
    'amgi_user_settings',
    `user_id=eq.${encodeURIComponent(userId)}&select=*`
  );

  if (remoteSettingsRows.length > 0) {
    const r = remoteSettingsRows[0];
    if (typeof r.two_button_mode === 'boolean') {
      await dbStore.saveSettings({ twoButtonMode: r.two_button_mode });
    }
  }
  const latestSettings = await dbStore.getSettings();
  await upsertRestRows(
    settings.supabaseUrl,
    settings.supabaseAnonKey,
    settings.supabaseAccessToken,
    'amgi_user_settings',
    [
      {
        user_id: userId,
        two_button_mode: latestSettings.twoButtonMode,
        night_mode: latestSettings.nightMode,
        updated_at: nowSec,
      },
    ],
    'user_id'
  );

  // 2. Gather local items
  onProgress?.({ phase: 'gather', detail: '로컬 데이터 수집 중...' });
  const [decks, noteTypes, notes, cards, revlogs, media] = await Promise.all([
    dbStore.getAllDecks(),
    dbStore.getAllNoteTypes(),
    dbStore.getAllNotes(),
    dbStore.getAllCards(),
    dbStore.getAllRevlogs(),
    dbStore.getAllMedia(),
  ]);

  // 3. Pull remote amgi_sync_items
  onProgress?.({ phase: 'pull', detail: '원격 데이터 가져오는 중...' });
  const remoteRows = await selectRestRows<RemoteSyncItemRow>(
    settings.supabaseUrl,
    settings.supabaseAnonKey,
    settings.supabaseAccessToken,
    'amgi_sync_items',
    `user_id=eq.${encodeURIComponent(userId)}&select=*`
  );

  const deckMap = new Map<number, Deck>(decks.map((d) => [d.id, d]));
  const ntMap = new Map<number, NoteType>(noteTypes.map((n) => [n.id, n]));
  const noteMap = new Map<number, Note>(notes.map((n) => [n.id, n]));
  const cardMap = new Map<number, Card>(cards.map((c) => [c.id, c]));
  const revlogMap = new Map<number, Revlog>(revlogs.map((r) => [r.id, r]));

  let pulledItems = 0;
  const mergeDecks: Deck[] = [];
  const mergeNts: NoteType[] = [];
  const mergeNotes: Note[] = [];
  const mergeCards: Card[] = [];
  const mergeRevlogs: Revlog[] = [];

  for (const row of remoteRows) {
    const payload = row.payload as Record<string, unknown>;
    if (!payload) continue;
    if (row.item_type === 'deck') {
      const d = payload as unknown as Deck;
      const local = deckMap.get(d.id);
      if (!local || (d.mod ?? row.updated_at) > (local.mod ?? 0)) {
        mergeDecks.push(d);
        deckMap.set(d.id, d);
        pulledItems++;
      }
    } else if (row.item_type === 'notetype') {
      const nt = payload as unknown as NoteType;
      const local = ntMap.get(nt.id);
      if (!local || (nt.mod ?? row.updated_at) > (local.mod ?? 0)) {
        mergeNts.push(nt);
        ntMap.set(nt.id, nt);
        pulledItems++;
      }
    } else if (row.item_type === 'note') {
      const n = payload as unknown as Note;
      const local = noteMap.get(n.id);
      if (!local || n.mod > local.mod) {
        mergeNotes.push(n);
        noteMap.set(n.id, n);
        pulledItems++;
      }
    } else if (row.item_type === 'card') {
      const c = payload as unknown as Card;
      const local = cardMap.get(c.id);
      if (!local || c.mod > local.mod) {
        mergeCards.push(c);
        cardMap.set(c.id, c);
        pulledItems++;
      }
    } else if (row.item_type === 'revlog') {
      const rv = payload as unknown as Revlog;
      if (!revlogMap.has(rv.id)) {
        mergeRevlogs.push(rv);
        revlogMap.set(rv.id, rv);
        pulledItems++;
      }
    }
  }

  await Promise.all([
    dbStore.putDecks(mergeDecks),
    dbStore.putNoteTypes(mergeNts),
    dbStore.putNotes(mergeNotes),
    dbStore.putCards(mergeCards),
    dbStore.putRevlogs(mergeRevlogs),
  ]);

  // 4. Push merged/local items to amgi_sync_items
  onProgress?.({ phase: 'push', detail: '원격 서버에 업로드 중...' });
  const pushRows: RemoteSyncItemRow[] = [];

  for (const d of deckMap.values()) {
    pushRows.push({
      user_id: userId,
      item_type: 'deck',
      item_id: String(d.id),
      payload: d,
      updated_at: d.mod ?? nowSec,
    });
  }
  for (const nt of ntMap.values()) {
    pushRows.push({
      user_id: userId,
      item_type: 'notetype',
      item_id: String(nt.id),
      payload: nt,
      updated_at: nt.mod ?? nowSec,
    });
  }
  for (const n of noteMap.values()) {
    pushRows.push({
      user_id: userId,
      item_type: 'note',
      item_id: String(n.id),
      payload: n,
      updated_at: n.mod || nowSec,
    });
  }
  for (const c of cardMap.values()) {
    pushRows.push({
      user_id: userId,
      item_type: 'card',
      item_id: String(c.id),
      payload: c,
      updated_at: c.mod || nowSec,
    });
  }
  for (const r of revlogMap.values()) {
    pushRows.push({
      user_id: userId,
      item_type: 'revlog',
      item_id: String(r.id),
      payload: r,
      updated_at: Math.floor(r.id / 1000),
    });
  }

  await upsertRestRows(
    settings.supabaseUrl,
    settings.supabaseAnonKey,
    settings.supabaseAccessToken,
    'amgi_sync_items',
    pushRows,
    'user_id,item_type,item_id'
  );

  // 5. Upload unsynced media to amgi-media Storage bucket
  onProgress?.({ phase: 'media', detail: '미디어 동기화 중...' });
  let uploadedMedia = 0;
  for (const m of media) {
    if (!m.remoteUrl && m.bytes && m.bytes.length > 0) {
      try {
        const remoteUrl = await uploadMediaObject(settings, m);
        await dbStore.putMedia({ ...m, remoteUrl });
        uploadedMedia++;
      } catch {
        // Continue syncing remaining media items
      }
    }
  }

  const syncedAt = Date.now();
  await dbStore.saveSettings({ lastSyncAt: syncedAt });

  return {
    pushedItems: pushRows.length,
    pulledItems,
    uploadedMedia,
    syncedAt,
  };
}
