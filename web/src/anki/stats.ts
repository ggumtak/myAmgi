import type Long from 'long';
import anki from './generated';
import { rpc } from './rpc';
import type { AnkiTypes } from './generated';

export type GraphsResponse = AnkiTypes.stats.GraphsResponse;
export type CardStatsResponse = AnkiTypes.stats.CardStatsResponse;

export async function graphs(search = '', days = 30): Promise<GraphsResponse> {
  return rpc('graphs', anki.stats.GraphsRequest, anki.stats.GraphsResponse, {
    search,
    days,
  });
}

export async function cardStats(cid: number | Long): Promise<CardStatsResponse> {
  return rpc('cardStats', anki.cards.CardId, anki.stats.CardStatsResponse, { cid });
}

export async function getGraphPreferences(): Promise<AnkiTypes.stats.GraphPreferences> {
  return rpc(
    'getGraphPreferences',
    anki.generic.Empty,
    anki.stats.GraphPreferences,
    {}
  );
}

export async function setGraphPreferences(
  prefs: AnkiTypes.stats.GraphPreferences.$Properties
): Promise<void> {
  await rpc(
    'setGraphPreferences',
    anki.stats.GraphPreferences,
    anki.generic.Empty,
    prefs
  );
}
