// Collection config and Anki preferences (scheduling, reviewing, editing, backups).
import { anki } from './proto';
import { invoke } from './rpc';

export const BoolKey = anki.config.ConfigKey.Bool;
export type Preferences = anki.config.Preferences;

const enc = new TextEncoder();
const dec = new TextDecoder();

export async function getConfigJson<T = unknown>(key: string): Promise<T> {
  const res = await invoke('getConfigJson', { val: key });
  return JSON.parse(dec.decode(res.json)) as T;
}

export async function setConfigJson(key: string, value: unknown, undoable = false): Promise<void> {
  await invoke('setConfigJson', { key, valueJson: enc.encode(JSON.stringify(value)), undoable });
}

export async function getConfigBool(key: anki.config.ConfigKey.Bool): Promise<boolean> {
  return (await invoke('getConfigBool', { key })).val;
}

export async function setConfigBool(key: anki.config.ConfigKey.Bool, value: boolean, undoable = false): Promise<void> {
  await invoke('setConfigBool', { key, value, undoable });
}

export function getPreferences(): Promise<Preferences> {
  return invoke('getPreferences', {});
}

export async function setPreferences(prefs: anki.config.Preferences.$Properties): Promise<void> {
  await invoke('setPreferences', prefs);
}
