// Note types: names, use counts, full definitions, field names.
import { anki } from './proto';
import { invoke } from './rpc';

export type Notetype = anki.notetypes.Notetype;

export async function notetypeNames() {
  return (await invoke('getNotetypeNames', {})).entries.map((e) => ({ id: e.id ?? 0, name: e.name ?? '' }));
}

export async function notetypeUseCounts() {
  return (await invoke('getNotetypeNamesAndCounts', {})).entries.map((e) => ({
    id: e.id ?? 0,
    name: e.name ?? '',
    useCount: e.useCount ?? 0,
  }));
}

export function getNotetype(ntid: number): Promise<Notetype> {
  return invoke('getNotetype', { ntid });
}

export async function fieldNames(ntid: number): Promise<string[]> {
  return (await invoke('getFieldNames', { ntid })).vals;
}
