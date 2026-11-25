import JSZip from 'jszip';
import { decompress } from 'fzstd';
import initSqlJs, { Database } from 'sql.js';
import {
  Card,
  CardFsrsData,
  CardQueue,
  CardType,
  Deck,
  MediaItem,
  Note,
  NoteType,
  NoteTypeTemplate,
  Revlog,
} from '../types/models';

export interface ParsedDeckConfigProto {
  newPerDay?: number;
  revPerDay?: number;
  desiredRetention?: number;
  fsrsParams?: number[];
  fsrsEnabled?: boolean;
}

export interface ApkgImportResult {
  decks: Deck[];
  noteTypes: NoteType[];
  notes: Note[];
  cards: Card[];
  revlogs: Revlog[];
  media: MediaItem[];
  format: 'legacy' | 'v21b';
  collectionCreatedAt: number;
}

const US_SEP = '\x1f';

// -------------------- Protobuf Wire Helpers --------------------

interface ProtoField {
  fieldNum: number;
  wireType: number;
  varint?: number;
  bytes?: Uint8Array;
  fixed64?: Uint8Array;
  fixed32?: Uint8Array;
}

function readVarint(buf: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let i = offset;
  while (i < buf.length) {
    const b = buf[i++];
    result += (b & 0x7f) * Math.pow(2, shift);
    if ((b & 0x80) === 0) break;
    shift += 7;
    if (shift > 56) break;
  }
  return { value: result, next: i };
}

export function decodeProtoFields(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const tagRes = readVarint(buf, offset);
    offset = tagRes.next;
    const tag = tagRes.value;
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;
    if (fieldNum === 0) break;

    if (wireType === 0) {
      const val = readVarint(buf, offset);
      offset = val.next;
      fields.push({ fieldNum, wireType, varint: val.value });
    } else if (wireType === 1) {
      const slice = buf.slice(offset, offset + 8);
      offset += 8;
      fields.push({ fieldNum, wireType, fixed64: slice });
    } else if (wireType === 2) {
      const lenRes = readVarint(buf, offset);
      offset = lenRes.next;
      const len = Math.max(0, Math.min(lenRes.value, buf.length - offset));
      const slice = buf.slice(offset, offset + len);
      offset += len;
      fields.push({ fieldNum, wireType, bytes: slice });
    } else if (wireType === 5) {
      const slice = buf.slice(offset, offset + 4);
      offset += 4;
      fields.push({ fieldNum, wireType, fixed32: slice });
    } else {
      break;
    }
  }
  return fields;
}

function readFloat32LE(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getFloat32(0, true);
}

function readFloat64LE(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getFloat64(0, true);
}

function readPackedFloats(bytes: Uint8Array): number[] {
  const arr: number[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i + 4 <= bytes.byteLength; i += 4) {
    arr.push(Number(view.getFloat32(i, true).toFixed(5)));
  }
  return arr;
}

/**
 * Parse Anki `deck_config.config` protobuf (`anki.deck_config.DeckConfig.Config`):
 * - field 2: new_per_day (uint32)
 * - field 3: reviews_per_day (uint32)
 * - field 31 (or nested): fsrs_params / desired_retention
 * - field 32/34/etc: desired_retention (float32 / double), fsrs_params (packed float32 or repeated float32)
 * Also supports Anki 23.10+ / 24.x field numbers:
 *   new_per_day = 2
 *   reviews_per_day = 3
 *   desired_retention = 31 (float) or 34 (float)
 *   fsrs_params_5 = 35 (packed float) / fsrs_params_4 = 32 (packed float)
 */
export function parseDeckConfigProtobuf(configBytes: Uint8Array): ParsedDeckConfigProto {
  const out: ParsedDeckConfigProto = {};
  if (!configBytes || configBytes.length === 0) return out;

  const fields = decodeProtoFields(configBytes);
  const unpackedFsrs: number[] = [];

  for (const f of fields) {
    if (f.fieldNum === 2 && f.varint !== undefined) {
      out.newPerDay = f.varint;
    } else if (f.fieldNum === 3 && f.varint !== undefined) {
      out.revPerDay = f.varint;
    } else if ((f.fieldNum === 31 || f.fieldNum === 34) && f.fixed32) {
      const val = readFloat32LE(f.fixed32);
      if (val >= 0.7 && val <= 0.999) {
        out.desiredRetention = Number(val.toFixed(4));
        out.fsrsEnabled = true;
      }
    } else if ((f.fieldNum === 31 || f.fieldNum === 34) && f.fixed64) {
      const val = readFloat64LE(f.fixed64);
      if (val >= 0.7 && val <= 0.999) {
        out.desiredRetention = Number(val.toFixed(4));
        out.fsrsEnabled = true;
      }
    } else if (f.fieldNum === 32 || f.fieldNum === 35 || f.fieldNum === 36) {
      if (f.bytes && f.bytes.length >= 16 && f.bytes.length % 4 === 0) {
        const parsed = readPackedFloats(f.bytes);
        if (parsed.length >= 17) {
          out.fsrsParams = parsed;
          out.fsrsEnabled = true;
        }
      } else if (f.fixed32) {
        unpackedFsrs.push(Number(readFloat32LE(f.fixed32).toFixed(5)));
      }
    }
  }

  if (!out.fsrsParams && unpackedFsrs.length >= 17) {
    out.fsrsParams = unpackedFsrs;
    out.fsrsEnabled = true;
  }

  return out;
}

/**
 * Parse Anki `cards.data` JSON string for FSRS fields (`s`, `d`, `dr`).
 */
export function parseCardDataJson(raw: unknown): CardFsrsData {
  if (!raw || typeof raw !== 'string') return {};
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '{}') return {};
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const data: CardFsrsData = { ...parsed };
    if (typeof parsed.s === 'number' && Number.isFinite(parsed.s)) {
      data.s = parsed.s;
      data.fsrs = true;
    }
    if (typeof parsed.d === 'number' && Number.isFinite(parsed.d)) {
      data.d = parsed.d;
      data.fsrs = true;
    }
    if (typeof parsed.dr === 'number' && Number.isFinite(parsed.dr)) {
      data.dr = parsed.dr;
    }
    return data;
  } catch {
    return {};
  }
}

/**
 * Parse Anki v21b `media` file (Zstd-compressed protobuf `MediaEntries { repeated MediaEntry entries = 1; }`
 * where `MediaEntry { string name = 1; uint32 size = 2; bytes sha1 = 3; ... }`)
 * or fallback JSON map `{"0": "filename.jpg", ...}`.
 */
export function parseV21bMediaManifest(rawBytes: Uint8Array): Map<string, string> {
  const map = new Map<string, string>();
  let bytes = rawBytes;

  // Check Zstd magic bytes: 0x28 0xB5 0x2F 0xFD
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x28 &&
    bytes[1] === 0xb5 &&
    bytes[2] === 0x2f &&
    bytes[3] === 0xfd
  ) {
    bytes = decompress(bytes);
  }

  // Try JSON first (legacy format)
  const textSample = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 64)).trim();
  if (textSample.startsWith('{')) {
    try {
      const json = JSON.parse(new TextDecoder('utf-8').decode(bytes)) as Record<string, string>;
      for (const [k, v] of Object.entries(json)) {
        map.set(k, v);
      }
      return map;
    } catch {
      // fall through to protobuf
    }
  }

  // Protobuf MediaEntries: repeated MediaEntry entries = 1;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const outer = decodeProtoFields(bytes);
  let idx = 0;
  for (const entryField of outer) {
    if (entryField.fieldNum === 1 && entryField.bytes) {
      const inner = decodeProtoFields(entryField.bytes);
      const nameField = inner.find((f) => f.fieldNum === 1 && f.bytes);
      if (nameField?.bytes) {
        const fileName = decoder.decode(nameField.bytes);
        map.set(String(idx), fileName);
      }
      idx++;
    }
  }

  return map;
}

/**
 * Parse Anki `templates.config` protobuf (`q_format = 1`, `a_format = 2`)
 */
function parseTemplateConfigProto(bytes: Uint8Array): { qfmt: string; afmt: string } {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const fields = decodeProtoFields(bytes);
  let qfmt = '';
  let afmt = '';
  for (const f of fields) {
    if (f.fieldNum === 1 && f.bytes) qfmt = decoder.decode(f.bytes);
    else if (f.fieldNum === 2 && f.bytes) afmt = decoder.decode(f.bytes);
  }
  return { qfmt, afmt };
}

/**
 * Parse Anki `notetypes.config` protobuf (`kind = 1` where 1=cloze, `css = 3` or `css = 4`)
 */
function parseNotetypeConfigProto(bytes: Uint8Array): { kind: 0 | 1; css: string } {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const fields = decodeProtoFields(bytes);
  let kind: 0 | 1 = 0;
  let css = '';
  for (const f of fields) {
    if (f.fieldNum === 1 && f.varint !== undefined) {
      kind = f.varint === 1 ? 1 : 0;
    } else if ((f.fieldNum === 3 || f.fieldNum === 4) && f.bytes) {
      const str = decoder.decode(f.bytes);
      if (str.length >= css.length) css = str;
    }
  }
  return { kind, css };
}

/**
 * Parse Anki `decks.common` protobuf (`config_id = 6` or `1`, `collapsed = 4` etc.)
 */
function parseDeckCommonProto(bytes: Uint8Array): { configId: number; collapsed: boolean } {
  const fields = decodeProtoFields(bytes);
  let configId = 1;
  let collapsed = false;
  for (const f of fields) {
    if (f.fieldNum === 6 && f.varint !== undefined) configId = f.varint;
    if (f.fieldNum === 4 && f.varint !== undefined) collapsed = f.varint !== 0;
  }
  return { configId, collapsed };
}

function guessMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.woff2')) return 'font/woff2';
  if (lower.endsWith('.woff')) return 'font/woff';
  if (lower.endsWith('.ttf')) return 'font/ttf';
  if (lower.endsWith('.otf')) return 'font/otf';
  return 'application/octet-stream';
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const copy = new Uint8Array(bytes);
    const digest = await crypto.subtle.digest('SHA-256', copy);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic FNV-based hex if crypto.subtle unavailable
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function queryRows(db: Database, sql: string): Record<string, unknown>[] {
  try {
    const res = db.exec(sql);
    if (!res || res.length === 0) return [];
    const { columns, values } = res[0];
    return values.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  } catch {
    return [];
  }
}

function hasTable(db: Database, tableName: string): boolean {
  const rows = queryRows(
    db,
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName.replace(/'/g, "''")}'`
  );
  return rows.length > 0;
}

function normalizeDeckName(raw: string): string {
  // v21b uses \x1f as hierarchy separator in decks.name
  return raw.replace(/\x1f/g, '::');
}

export async function importApkgFile(file: File | ArrayBuffer): Promise<ApkgImportResult> {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const v21bEntry = zip.file('collection.anki21b');
  const v21Entry = zip.file('collection.anki21');
  const v2Entry = zip.file('collection.anki2');

  let format: 'legacy' | 'v21b' = 'legacy';
  let sqliteBytes: Uint8Array;

  if (v21bEntry) {
    format = 'v21b';
    const compressed = await v21bEntry.async('uint8array');
    sqliteBytes = decompress(compressed);
  } else if (v21Entry) {
    sqliteBytes = await v21Entry.async('uint8array');
  } else if (v2Entry) {
    sqliteBytes = await v2Entry.async('uint8array');
  } else {
    throw new Error('유효한 Anki .apkg 파일이 아닙니다 (collection 데이터베이스 없음).');
  }

  const basePath =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
      ? import.meta.env.BASE_URL
      : './';

  const SQL = await initSqlJs({
    locateFile: (fileName: string) => `${basePath}${fileName}`,
  });
  const db = new SQL.Database(sqliteBytes);

  try {
    const colRows = queryRows(db, 'SELECT * FROM col LIMIT 1');
    const col = colRows[0] ?? {};
    const collectionCreatedAt =
      typeof col.crt === 'number' && col.crt > 0 ? col.crt * 1000 : Date.now();

    const decks: Deck[] = [];
    const noteTypes: NoteType[] = [];

    const isModernSchema = hasTable(db, 'notetypes') && hasTable(db, 'decks');

    if (isModernSchema) {
      // Parse v21b deck_config
      const deckConfigs = new Map<number, ParsedDeckConfigProto>();
      const dconfRows = queryRows(db, 'SELECT id, name, config FROM deck_config');
      for (const r of dconfRows) {
        const id = Number(r.id);
        const cfgBytes = r.config instanceof Uint8Array ? r.config : new Uint8Array(0);
        deckConfigs.set(id, parseDeckConfigProtobuf(cfgBytes));
      }

      // Parse v21b decks
      const deckRows = queryRows(db, 'SELECT id, name, common FROM decks');
      for (const r of deckRows) {
        const id = Number(r.id);
        const name = normalizeDeckName(String(r.name ?? 'Default'));
        const commonBytes = r.common instanceof Uint8Array ? r.common : new Uint8Array(0);
        const common = parseDeckCommonProto(commonBytes);
        const cfg = deckConfigs.get(common.configId) ?? {};
        decks.push({
          id,
          name,
          parent: name.includes('::') ? name.split('::').slice(0, -1).join('::') : undefined,
          configId: common.configId,
          collapsed: common.collapsed,
          newPerDay: cfg.newPerDay ?? 20,
          revPerDay: cfg.revPerDay ?? 200,
          fsrsEnabled: cfg.fsrsEnabled ?? true,
          desiredRetention: cfg.desiredRetention ?? 0.9,
          fsrsParams: cfg.fsrsParams,
        });
      }

      // Parse v21b notetypes, fields, templates
      const ntRows = queryRows(db, 'SELECT id, name, config FROM notetypes');
      const fieldRows = queryRows(db, 'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord');
      const tmplRows = queryRows(db, 'SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord');

      const fieldsByNt = new Map<number, string[]>();
      for (const fr of fieldRows) {
        const ntid = Number(fr.ntid);
        const arr = fieldsByNt.get(ntid) ?? [];
        arr.push(String(fr.name ?? `Field ${arr.length + 1}`));
        fieldsByNt.set(ntid, arr);
      }

      const tmplsByNt = new Map<number, NoteTypeTemplate[]>();
      for (const tr of tmplRows) {
        const ntid = Number(tr.ntid);
        const cfgBytes = tr.config instanceof Uint8Array ? tr.config : new Uint8Array(0);
        const { qfmt, afmt } = parseTemplateConfigProto(cfgBytes);
        const arr = tmplsByNt.get(ntid) ?? [];
        arr.push({
          ord: Number(tr.ord ?? arr.length),
          name: String(tr.name ?? `Card ${arr.length + 1}`),
          qfmt: qfmt || '{{Front}}',
          afmt: afmt || '{{FrontSide}}<hr id="answer">{{Back}}',
        });
        tmplsByNt.set(ntid, arr);
      }

      for (const ntr of ntRows) {
        const id = Number(ntr.id);
        const cfgBytes = ntr.config instanceof Uint8Array ? ntr.config : new Uint8Array(0);
        const { kind, css } = parseNotetypeConfigProto(cfgBytes);
        noteTypes.push({
          id,
          name: String(ntr.name ?? 'Basic'),
          fields: fieldsByNt.get(id) ?? ['Front', 'Back'],
          templates: tmplsByNt.get(id) ?? [
            { ord: 0, name: 'Card 1', qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr id="answer">{{Back}}' },
          ],
          css,
          kind,
        });
      }
    }

    // Fallback or supplement from legacy JSON col.decks / col.dconf / col.models
    if (decks.length === 0 && typeof col.decks === 'string') {
      const dconfJson =
        typeof col.dconf === 'string'
          ? (JSON.parse(col.dconf) as Record<string, Record<string, unknown>>)
          : {};
      const decksJson = JSON.parse(col.decks) as Record<string, Record<string, unknown>>;
      for (const d of Object.values(decksJson)) {
        const id = Number(d.id);
        const confId = Number(d.conf ?? 1);
        const dconf = dconfJson[String(confId)] ?? {};
        const newConf = (dconf.new as Record<string, unknown>) ?? {};
        const revConf = (dconf.rev as Record<string, unknown>) ?? {};
        const name = normalizeDeckName(String(d.name ?? 'Default'));
        decks.push({
          id,
          name,
          parent: name.includes('::') ? name.split('::').slice(0, -1).join('::') : undefined,
          configId: confId,
          collapsed: Boolean(d.collapsed),
          newPerDay: Number(newConf.perDay ?? 20),
          revPerDay: Number(revConf.perDay ?? 200),
          fsrsEnabled: true,
          desiredRetention: Number(dconf.desiredRetention ?? 0.9),
          fsrsParams: Array.isArray(dconf.fsrsParams5)
            ? (dconf.fsrsParams5 as number[])
            : undefined,
        });
      }
    }

    if (noteTypes.length === 0 && typeof col.models === 'string') {
      const modelsJson = JSON.parse(col.models) as Record<string, Record<string, unknown>>;
      for (const m of Object.values(modelsJson)) {
        const id = Number(m.id);
        const flds = Array.isArray(m.flds)
          ? (m.flds as Record<string, unknown>[]).map((f) => String(f.name ?? ''))
          : ['Front', 'Back'];
        const tmpls = Array.isArray(m.tmpls)
          ? (m.tmpls as Record<string, unknown>[]).map((t, i) => ({
              ord: Number(t.ord ?? i),
              name: String(t.name ?? `Card ${i + 1}`),
              qfmt: String(t.qfmt ?? ''),
              afmt: String(t.afmt ?? ''),
            }))
          : [];
        noteTypes.push({
          id,
          name: String(m.name ?? 'Basic'),
          fields: flds,
          templates: tmpls,
          css: String(m.css ?? ''),
          kind: Number(m.type ?? 0) === 1 ? 1 : 0,
        });
      }
    }

    // Parse notes
    const noteRows = queryRows(db, 'SELECT id, guid, mid, mod, tags, flds FROM notes');
    const notes: Note[] = noteRows.map((r) => ({
      id: Number(r.id),
      guid: String(r.guid ?? ''),
      mid: Number(r.mid),
      mod: Number(r.mod ?? 0),
      tags: String(r.tags ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean),
      flds: String(r.flds ?? '').split(US_SEP),
    }));

    // Parse cards including `data` JSON for FSRS
    const cardRows = queryRows(
      db,
      'SELECT id, nid, did, ord, mod, type, queue, due, ivl, factor, reps, lapses, data FROM cards'
    );
    const cards: Card[] = cardRows.map((r) => ({
      id: Number(r.id),
      nid: Number(r.nid),
      did: Number(r.did),
      ord: Number(r.ord ?? 0),
      mod: Number(r.mod ?? 0),
      type: (Number(r.type ?? 0) as CardType) || 0,
      queue: (Number(r.queue ?? 0) as CardQueue) ?? 0,
      due: Number(r.due ?? 0),
      ivl: Number(r.ivl ?? 0),
      factor: Number(r.factor ?? 2500),
      reps: Number(r.reps ?? 0),
      lapses: Number(r.lapses ?? 0),
      data: parseCardDataJson(r.data),
    }));

    // Parse revlogs
    const revRows = queryRows(
      db,
      'SELECT id, cid, ease, ivl, lastIvl, factor, time, type FROM revlog'
    );
    const revlogs: Revlog[] = revRows.map((r) => ({
      id: Number(r.id),
      cid: Number(r.cid),
      ease: (Math.min(4, Math.max(1, Number(r.ease ?? 3))) as 1 | 2 | 3 | 4),
      ivl: Number(r.ivl ?? 0),
      lastIvl: Number(r.lastIvl ?? 0),
      factor: Number(r.factor ?? 0),
      time: Number(r.time ?? 0),
      type: Number(r.type ?? 0),
    }));

    // Parse media
    const media: MediaItem[] = [];
    const mediaEntry = zip.file('media');
    if (mediaEntry) {
      const mediaManifestBytes = await mediaEntry.async('uint8array');
      const mediaMap = parseV21bMediaManifest(mediaManifestBytes);
      for (const [zipKey, realName] of mediaMap.entries()) {
        const entry = zip.file(zipKey);
        if (!entry) continue;
        let bytes = await entry.async('uint8array');
        // In v21b, individual media blobs may also be Zstd compressed
        if (
          format === 'v21b' &&
          bytes.length >= 4 &&
          bytes[0] === 0x28 &&
          bytes[1] === 0xb5 &&
          bytes[2] === 0x2f &&
          bytes[3] === 0xfd
        ) {
          try {
            bytes = decompress(bytes);
          } catch {
            // keep raw if not valid zstd
          }
        }
        const sha256 = await sha256Hex(bytes);
        media.push({
          name: realName,
          bytes,
          mime: guessMimeType(realName),
          sha256,
        });
      }
    }

    return {
      decks,
      noteTypes,
      notes,
      cards,
      revlogs,
      media,
      format,
      collectionCreatedAt,
    };
  } finally {
    db.close();
  }
}
