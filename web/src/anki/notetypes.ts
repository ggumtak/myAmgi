import type Long from 'long';
import anki from './generated';
import { decodeJsonBytes, encodeJsonBytes, rpc, toNumber } from './rpc';
import type { AnkiTypes } from './generated';

export type Notetype = AnkiTypes.notetypes.Notetype;
export type NotetypeNameId = AnkiTypes.notetypes.NotetypeNameId.$Properties;
export type NotetypeNameIdUseCount = AnkiTypes.notetypes.NotetypeNameIdUseCount.$Properties;
export type StockNotetypeKind = AnkiTypes.notetypes.StockNotetype.Kind;
export type ChangeNotetypeInfo = AnkiTypes.notetypes.ChangeNotetypeInfo;

export const StockNotetypeKind = anki.notetypes.StockNotetype.Kind;
export const OriginalStockKind = anki.notetypes.StockNotetype.OriginalStockKind;
export const NotetypeKind = anki.notetypes.Notetype.Config.Kind;

export async function getNotetypeNames(): Promise<NotetypeNameId[]> {
  const res = await rpc(
    'getNotetypeNames',
    anki.generic.Empty,
    anki.notetypes.NotetypeNames,
    {}
  );
  return res.entries ?? [];
}

export async function getNotetypeNamesAndCounts(): Promise<NotetypeNameIdUseCount[]> {
  const res = await rpc(
    'getNotetypeNamesAndCounts',
    anki.generic.Empty,
    anki.notetypes.NotetypeUseCounts,
    {}
  );
  return res.entries ?? [];
}

export async function getNotetype(ntid: number | Long): Promise<Notetype> {
  return rpc('getNotetype', anki.notetypes.NotetypeId, anki.notetypes.Notetype, {
    ntid,
  });
}

export async function addNotetype(
  nt: AnkiTypes.notetypes.Notetype.$Properties
): Promise<AnkiTypes.collection.OpChangesWithId> {
  return rpc(
    'addNotetype',
    anki.notetypes.Notetype,
    anki.collection.OpChangesWithId,
    nt
  );
}

export async function updateNotetype(
  nt: AnkiTypes.notetypes.Notetype.$Properties
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'updateNotetype',
    anki.notetypes.Notetype,
    anki.collection.OpChanges,
    nt
  );
}

export async function addOrUpdateNotetype(params: {
  json: Record<string, unknown> | Uint8Array;
  preserveUsnAndMtime?: boolean;
  skipChecks?: boolean;
}): Promise<number> {
  const jsonBytes =
    params.json instanceof Uint8Array ? params.json : encodeJsonBytes(params.json);
  const res = await rpc(
    'addOrUpdateNotetype',
    anki.notetypes.AddOrUpdateNotetypeRequest,
    anki.notetypes.NotetypeId,
    {
      json: jsonBytes,
      preserveUsnAndMtime: params.preserveUsnAndMtime ?? false,
      skipChecks: params.skipChecks ?? false,
    }
  );
  return toNumber(res.ntid);
}

export async function removeNotetype(
  ntid: number | Long
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'removeNotetype',
    anki.notetypes.NotetypeId,
    anki.collection.OpChanges,
    { ntid }
  );
}

export async function getStockNotetype<T = Record<string, unknown>>(
  kind: StockNotetypeKind
): Promise<T> {
  const res = await rpc(
    'getStockNotetypeLegacy',
    anki.notetypes.StockNotetype,
    anki.generic.Json,
    { kind }
  );
  return decodeJsonBytes<T>(res.json);
}

export const getStockNotetypeLegacy = getStockNotetype;

export async function getChangeNotetypeInfo(
  oldNotetypeId: number | Long,
  newNotetypeId: number | Long
): Promise<ChangeNotetypeInfo> {
  return rpc(
    'getChangeNotetypeInfo',
    anki.notetypes.GetChangeNotetypeInfoRequest,
    anki.notetypes.ChangeNotetypeInfo,
    { oldNotetypeId, newNotetypeId }
  );
}

export async function changeNotetype(
  req: AnkiTypes.notetypes.ChangeNotetypeRequest.$Properties
): Promise<AnkiTypes.collection.OpChanges> {
  return rpc(
    'changeNotetype',
    anki.notetypes.ChangeNotetypeRequest,
    anki.collection.OpChanges,
    req
  );
}
