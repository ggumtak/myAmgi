// Statistics: card info, graphs data, graph preferences.
import { invoke } from './rpc';

export function cardStats(cid: number) {
  return invoke('cardStats', { cid });
}

export function graphs(search: string, days: number) {
  return invoke('graphs', { search, days });
}

export function graphPreferences() {
  return invoke('getGraphPreferences', {});
}
