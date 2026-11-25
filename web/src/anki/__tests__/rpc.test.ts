import { afterEach, describe, expect, it, vi } from 'vitest';
import { anki } from '../generated/proto.js';
import { methods } from '../generated/methods';
import { AnkiError, call, configureRpc, HostUnreachableError, invoke } from '../rpc';
import { deckTree } from '../decks';
import { studiedToday, stripIsolates } from '../scheduler';

// Bytes produced by the official Python library (anki==26.9.4, `SerializeToString()`).
const fromHex = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const PY = {
  deckTreeRequest: '08808292c906',
  setDeckCollapsed: '08cbedf1a7a13410011801',
  cardIds: '0a080102cbedf1a7a134',
  deckNormalOptional: '08051211ec9dbcebb3b8ec96b43a3aed959cec9e90320e080122083c623e783c2f623e3000',
  translate: '080110021a0d0a046e616d6512050a03eb8db11a120a05636f756e741209110000000000000840',
  searchNode: '0a130a0b7a09ec9dbcebb3b8ec96b40a0260031001',
  queuedCountsOnly: '100418022006',
};

describe('protobuf encoding matches the Python/Rust engine', () => {
  it('encodes scalars, int64 and enums identically', () => {
    expect(toHex(anki.decks.DeckTreeRequest.encode({ now: 1764000000 }).finish())).toBe(PY.deckTreeRequest);
    const req = { deckId: 1795648419531, collapsed: true, scope: anki.decks.SetDeckCollapsedRequest.Scope.BROWSER };
    expect(toHex(anki.decks.SetDeckCollapsedRequest.encode(req).finish())).toBe(PY.setDeckCollapsed);
  });

  it('packs repeated int64 like proto3', () => {
    expect(toHex(anki.cards.CardIds.encode({ cids: [1, 2, 1795648419531] }).finish())).toBe(PY.cardIds);
  });

  it('encodes proto3 optional fields that are set to zero, oneofs and UTF-8', () => {
    const deck = { id: 5, name: '일본어::한자', normal: { configId: 1, reviewLimit: 0, description: '<b>x</b>' } };
    expect(toHex(anki.decks.Deck.encode(deck).finish())).toBe(PY.deckNormalOptional);
    const node = {
      group: {
        joiner: anki.search.SearchNode.Group.Joiner.OR,
        nodes: [{ deck: '일본어' }, { cardState: anki.search.SearchNode.CardState.CARD_STATE_DUE }],
      },
    };
    expect(toHex(anki.search.SearchNode.encode(node).finish())).toBe(PY.searchNode);
  });

  it('decodes maps, oneofs, optionals and int64 as numbers', () => {
    const t = anki.i18n.TranslateStringRequest.decode(fromHex(PY.translate));
    expect(t.moduleIndex).toBe(1);
    expect(t.args.count.number).toBe(3);
    expect(t.args.name.str).toBe('덱');
    const d = anki.decks.Deck.decode(fromHex(PY.deckNormalOptional));
    expect(d.name).toBe('일본어::한자');
    expect(d.kind).toBe('normal');
    expect(d.normal!.reviewLimit).toBe(0);
    const ids = anki.cards.CardIds.decode(fromHex(PY.cardIds));
    expect(ids.cids).toEqual([1, 2, 1795648419531]);
    expect(typeof ids.cids[2]).toBe('number');
    const s = anki.search.SearchNode.decode(fromHex(PY.searchNode));
    expect(s.filter).toBe('group');
    expect(s.group!.nodes![0].deck).toBe('일본어');
  });

  it('gives unset fields their proto3 defaults when decoding', () => {
    const q = anki.scheduler.QueuedCards.decode(fromHex(PY.queuedCountsOnly));
    expect([q.newCount, q.learningCount, q.reviewCount]).toEqual([4, 2, 6]);
    expect(q.cards).toEqual([]);
  });
});

describe('method table', () => {
  it('maps every method to /_anki/<lowerCamelCase>', () => {
    for (const [name, spec] of Object.entries(methods)) {
      expect(spec.path).toBe(`/_anki/${name}`);
      expect(name[0]).toBe(name[0].toLowerCase());
      expect(typeof spec.request.encode).toBe('function');
      expect(typeof spec.response.decode).toBe('function');
    }
  });

  it('includes both XxxService and BackendXxxService methods', () => {
    expect(methods.getQueuedCards.service).toBe('anki.scheduler.SchedulerService');
    expect(methods.getQueuedCards.request).toBe(anki.scheduler.GetQueuedCardsRequest);
    expect(methods.getQueuedCards.response).toBe(anki.scheduler.QueuedCards);
    expect(methods.syncCollection.service).toBe('anki.sync.BackendSyncService');
    expect(methods.deckTree.request).toBe(anki.decks.DeckTreeRequest);
    expect(Object.keys(methods).length).toBeGreaterThan(250);
  });
});

describe('call()', () => {
  afterEach(() => configureRpc({ fetch: (i, init) => fetch(i, init), baseUrl: '' }));

  it('POSTs binary protobuf with credentials and decodes the reply', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
      const body = anki.decks.DeckTreeNode.encode({ children: [{ deckId: 7, name: '영어', newCount: 3 }] }).finish();
      return new Response(body.slice(), { status: 200 });
    });
    configureRpc({ fetch: fetchMock });
    const tree = await deckTree(1764000000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/_anki/deckTree');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/binary');
    expect(toHex(init.body as Uint8Array)).toBe(PY.deckTreeRequest);
    expect(tree.children[0].name).toBe('영어');
    expect(tree.children[0].newCount).toBe(3);
  });

  it('deckTree defaults `now` to the current time (counts are zero with now=0)', async () => {
    let sent: Uint8Array | undefined;
    configureRpc({
      fetch: async (_u, init) => {
        sent = init.body as Uint8Array;
        return new Response(new Uint8Array(), { status: 200 });
      },
    });
    await deckTree();
    const now = anki.decks.DeckTreeRequest.decode(sent!).now;
    expect(Math.abs(now - Date.now() / 1000)).toBeLessThan(5);
  });

  it('maps non-2xx to AnkiError with the backend message', async () => {
    configureRpc({ fetch: async () => new Response('데이터베이스가 일관적이지 않습니다. No such deck', { status: 500 }) });
    const err = await invoke('getDeck', { did: 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(AnkiError);
    expect(err.method).toBe('getDeck');
    expect(err.status).toBe(500);
    expect(err.backendMessage).toBe('데이터베이스가 일관적이지 않습니다. No such deck');
    expect(err.message).toBe(err.backendMessage);
  });

  it('gives a Korean fallback message for an empty error body', async () => {
    configureRpc({ fetch: async () => new Response('', { status: 403 }) });
    const err = await invoke('getDeck', { did: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(AnkiError);
    expect(err.message).toBe('엔진 오류 (403)');
  });

  it('maps network failures to HostUnreachableError', async () => {
    configureRpc({
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await expect(call('deckTree', anki.decks.DeckTreeRequest, anki.decks.DeckTreeNode, { now: 1 })).rejects.toBeInstanceOf(
      HostUnreachableError,
    );
  });

  it('strips bidi isolation marks from studiedToday', async () => {
    configureRpc({
      fetch: async () => new Response(anki.generic.String.encode({ val: '공부 ⁨2⁩카드' }).finish().slice(), { status: 200 }),
    });
    expect(await studiedToday()).toBe('공부 2카드');
    expect(stripIsolates('⁨a⁩')).toBe('a');
  });
});
