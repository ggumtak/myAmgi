import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Long from 'long';

import anki, { type AnkiTypes } from '../anki/generated';
import {
  AnkiError,
  configureAnkiRpc,
  decodeJsonBytes,
  encodeJsonBytes,
  getAnkiRpcConfig,
  toNumber,
} from '../anki/rpc';
import * as decks from '../anki/decks';
import * as scheduler from '../anki/scheduler';
import * as notes from '../anki/notes';
import * as notetypes from '../anki/notetypes';
import * as search from '../anki/search';
import * as stats from '../anki/stats';
import * as tools from '../anki/tools';
import { configureHostApi, host, HostApiError } from '../host';

const nodeImport = (specifier: string) => import(/* @vite-ignore */ specifier);

interface ChildProcessLike {
  killed: boolean;
  stdout: {
    on(ev: 'data', fn: (chunk: Uint8Array) => void): void;
    off(ev: 'data', fn: (chunk: Uint8Array) => void): void;
  };
  stderr: {
    on(ev: 'data', fn: (chunk: Uint8Array) => void): void;
    off(ev: 'data', fn: (chunk: Uint8Array) => void): void;
  };
  once(ev: 'exit', fn: (code: number | null, signal: string | null) => void): void;
  off(ev: 'exit', fn: (code: number | null, signal: string | null) => void): void;
  kill(signal?: string): boolean;
}

async function getPaths() {
  const path = (await nodeImport('node:path')) as {
    dirname: (p: string) => string;
    join: (...parts: string[]) => string;
    resolve: (...parts: string[]) => string;
  };
  const { fileURLToPath } = (await nodeImport('node:url')) as {
    fileURLToPath: (u: string) => string;
  };
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const repoRoot = path.resolve(dirname, '../../..');
  const desktopBin = path.join(repoRoot, 'desktop/build/install/desktop/bin/desktop');
  return { path, repoRoot, desktopBin };
}

async function getFreePort(): Promise<number> {
  const net = (await nodeImport('node:net')) as {
    createServer: () => {
      unref(): void;
      on(ev: 'error', fn: (err: unknown) => void): void;
      listen(port: number, host: string, cb: () => void): void;
      address(): { port: number } | string | null;
      close(cb: (err?: unknown) => void): void;
    };
  };
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err?: unknown) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForHostReady(
  proc: ChildProcessLike,
  port: number,
  token: string,
  timeoutMs = 30_000
): Promise<void> {
  const start = Date.now();
  let exited = false;
  let logs = '';
  const decoder = new TextDecoder();

  const onStdout = (chunk: Uint8Array) => {
    logs += decoder.decode(chunk);
  };
  const onStderr = (chunk: Uint8Array) => {
    logs += decoder.decode(chunk);
  };
  const onExit = (code: number | null, signal: string | null) => {
    exited = true;
    logs += `\n[exit code=${code} signal=${signal}]`;
  };

  proc.stdout.on('data', onStdout);
  proc.stderr.on('data', onStderr);
  proc.once('exit', onExit);

  try {
    while (Date.now() - start < timeoutMs) {
      if (exited) {
        throw new Error(`Desktop host exited prematurely:\n${logs}`);
      }
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/host/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Amgi-Token': token,
          },
          body: '{}',
        });
        if (res.ok) return;
      } catch {
        // Not listening yet
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`Timed out waiting for desktop host on port ${port}:\n${logs}`);
  } finally {
    proc.stdout.off('data', onStdout);
    proc.stderr.off('data', onStderr);
    proc.off('exit', onExit);
  }
}

describe('Anki protobuf round-trip encoding/decoding', () => {
  it('encodes and decodes decks messages including nested DeckTreeNode and DeckConfig', () => {
    const reqBytes = anki.decks.DeckTreeRequest.encode({ now: 1700000000 }).finish();
    const decodedReq = anki.decks.DeckTreeRequest.decode(reqBytes);
    expect(toNumber(decodedReq.now)).toBe(1700000000);

    const deckPayload: AnkiTypes.decks.Deck.$Properties = {
      id: Long.fromNumber(1700000001234),
      name: '일본어::한자',
      mtimeSecs: 1700000100,
      usn: -1,
      common: {
        studyCollapsed: false,
        browserCollapsed: true,
        lastDayStudied: 42,
        newStudied: 5,
        reviewStudied: 12,
        learningStudied: 3,
      },
      normal: {
        configId: 1,
        description: '한자 학습 덱',
        markdownDescription: false,
      },
    };
    const deckBytes = anki.decks.Deck.encode(deckPayload).finish();
    const decodedDeck = anki.decks.Deck.decode(deckBytes);
    expect(toNumber(decodedDeck.id)).toBe(1700000001234);
    expect(decodedDeck.name).toBe('일본어::한자');
    expect(decodedDeck.common?.browserCollapsed).toBe(true);
    expect(decodedDeck.normal?.description).toBe('한자 학습 덱');

    const treeBytes = anki.decks.DeckTreeNode.encode({
      deckId: 1,
      name: '',
      level: 0,
      collapsed: false,
      reviewCount: 7,
      learnCount: 2,
      newCount: 15,
      children: [
        {
          deckId: 100,
          name: '일본어',
          level: 1,
          collapsed: false,
          reviewCount: 7,
          learnCount: 2,
          newCount: 15,
        },
      ],
    }).finish();
    const decodedTree = anki.decks.DeckTreeNode.decode(treeBytes);
    expect(decodedTree.newCount).toBe(15);
    expect(decodedTree.children).toHaveLength(1);
    expect(decodedTree.children[0].name).toBe('일본어');
  });

  it('encodes and decodes scheduler messages (QueuedCards, CardAnswer, RenderCardResponse, ExtractAvTags)', () => {
    const queueBytes = anki.scheduler.GetQueuedCardsRequest.encode({
      fetchLimit: 10,
      intradayLearningOnly: true,
    }).finish();
    const decodedQueueReq = anki.scheduler.GetQueuedCardsRequest.decode(queueBytes);
    expect(decodedQueueReq.fetchLimit).toBe(10);
    expect(decodedQueueReq.intradayLearningOnly).toBe(true);

    const ansBytes = anki.scheduler.CardAnswer.encode({
      cardId: Long.fromNumber(9876543210),
      rating: scheduler.Rating.GOOD,
      answeredAtMillis: Long.fromNumber(1700000005000),
      millisecondsTaken: 2450,
      currentState: { normal: { new: { position: 3 } } },
      newState: { normal: { review: { scheduledDays: 4, elapsedDays: 0, easeFactor: 2.5 } } },
    }).finish();
    const decodedAns = anki.scheduler.CardAnswer.decode(ansBytes);
    expect(toNumber(decodedAns.cardId)).toBe(9876543210);
    expect(decodedAns.rating).toBe(anki.scheduler.CardAnswer.Rating.GOOD);
    expect(decodedAns.millisecondsTaken).toBe(2450);
    expect(decodedAns.newState?.normal?.review?.scheduledDays).toBe(4);

    const renderBytes = anki.card_rendering.RenderCardResponse.encode({
      questionNodes: [{ text: '<div>勉強</div>' }],
      answerNodes: [{ text: '<div>勉強</div><hr id=answer>공부' }],
      css: '.card { font-size: 20px; }',
      latexSvg: false,
      isEmpty: false,
    }).finish();
    const decodedRender = anki.card_rendering.RenderCardResponse.decode(renderBytes);
    expect(decodedRender.questionNodes[0].text).toContain('勉強');
    expect(decodedRender.answerNodes[0].text).toContain('공부');
    expect(decodedRender.css).toBe('.card { font-size: 20px; }');

    const avBytes = anki.card_rendering.ExtractAvTagsResponse.encode({
      text: '단어 ',
      avTags: [{ soundOrVideo: 'word.mp3' }],
    }).finish();
    const decodedAv = anki.card_rendering.ExtractAvTagsResponse.decode(avBytes);
    expect(decodedAv.text).toBe('단어 ');
    expect(decodedAv.avTags[0].soundOrVideo).toBe('word.mp3');
  });

  it('encodes and decodes notes and notetypes messages (Note, Notetype, ChangeNotetypeRequest)', () => {
    const noteBytes = anki.notes.Note.encode({
      id: Long.fromNumber(123456),
      guid: 'abc-123',
      notetypeId: Long.fromNumber(555),
      mtimeSecs: 1700000000,
      usn: 0,
      tags: ['한자', 'JLPT'],
      fields: ['漢字', '한자'],
    }).finish();
    const decodedNote = anki.notes.Note.decode(noteBytes);
    expect(toNumber(decodedNote.id)).toBe(123456);
    expect(decodedNote.tags).toEqual(['한자', 'JLPT']);
    expect(decodedNote.fields).toEqual(['漢字', '한자']);

    const ntBytes = anki.notetypes.Notetype.encode({
      id: Long.fromNumber(555),
      name: '기본',
      mtimeSecs: 1700000000,
      usn: 0,
      config: {
        kind: notetypes.NotetypeKind.KIND_NORMAL,
        css: '.card { color: black; }',
      },
      fields: [
        { name: '앞면', ord: { val: 0 }, config: { fontName: 'Noto Sans KR', fontSize: 20 } },
        { name: '뒷면', ord: { val: 1 }, config: { fontName: 'Noto Sans KR', fontSize: 20 } },
      ],
      templates: [
        {
          name: '카드 1',
          ord: { val: 0 },
          config: { qFormat: '{{앞면}}', aFormat: '{{FrontSide}}<hr id=answer>{{뒷면}}' },
        },
      ],
    }).finish();
    const decodedNt = anki.notetypes.Notetype.decode(ntBytes);
    expect(decodedNt.name).toBe('기본');
    expect(decodedNt.fields).toHaveLength(2);
    expect(decodedNt.fields[0].ord?.val).toBe(0);
    expect(decodedNt.templates[0].config?.qFormat).toBe('{{앞면}}');
  });

  it('encodes and decodes search, stats, and config messages', () => {
    const searchBytes = anki.search.SearchRequest.encode({
      search: 'deck:"일본어::한자" is:due',
      order: { builtin: { column: 'cardDue', reverse: false } },
    }).finish();
    const decodedSearch = anki.search.SearchRequest.decode(searchBytes);
    expect(decodedSearch.search).toBe('deck:"일본어::한자" is:due');
    expect(decodedSearch.order?.builtin?.column).toBe('cardDue');

    const graphsBytes = anki.stats.GraphsRequest.encode({
      search: 'deck:*',
      days: 90,
    }).finish();
    const decodedGraphs = anki.stats.GraphsRequest.decode(graphsBytes);
    expect(decodedGraphs.search).toBe('deck:*');
    expect(decodedGraphs.days).toBe(90);

    const prefsBytes = anki.config.Preferences.encode({
      scheduling: {
        newReviewMix: tools.NewReviewMix.NEW_FIRST,
        rollover: 4,
      },
      reviewing: {
        showRemainingDueCounts: true,
        hideAudioPlayButtons: false,
      },
      editing: {
        pasteStripsFormatting: true,
      },
      backups: {
        daily: 20,
        weekly: 8,
        monthly: 6,
        minimumIntervalMins: 30,
      },
    }).finish();
    const decodedPrefs = anki.config.Preferences.decode(prefsBytes);
    expect(decodedPrefs.scheduling?.rollover).toBe(4);
    expect(decodedPrefs.scheduling?.newReviewMix).toBe(tools.NewReviewMix.NEW_FIRST);
    expect(decodedPrefs.reviewing?.showRemainingDueCounts).toBe(true);
    expect(decodedPrefs.editing?.pasteStripsFormatting).toBe(true);
    expect(decodedPrefs.backups?.daily).toBe(20);
    expect(decodedPrefs.backups?.minimumIntervalMins).toBe(30);
  });

  it('provides helper utilities (toNumber, JSON bytes codec, configureAnkiRpc)', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(Long.fromNumber(9007199254740991))).toBe(9007199254740991);
    expect(toNumber(BigInt(12345))).toBe(12345);
    expect(toNumber(undefined, -1)).toBe(-1);

    const encoded = encodeJsonBytes({ hello: '안녕', count: 3 });
    expect(decodeJsonBytes<{ hello: string; count: number }>(encoded)).toEqual({
      hello: '안녕',
      count: 3,
    });
    expect(decodeJsonBytes(new Uint8Array())).toBeNull();

    configureAnkiRpc({ baseUrl: 'http://127.0.0.1:12345/', headers: { 'X-Amgi-Token': 'abc' } });
    expect(getAnkiRpcConfig()).toEqual({
      baseUrl: 'http://127.0.0.1:12345',
      headers: { 'X-Amgi-Token': 'abc' },
    });
    configureAnkiRpc({ baseUrl: '', headers: {} });
  });
});

describe('Live desktop host RPC integration', () => {
  const token = 'rpctest';
  let tempDir = '';
  let port = 0;
  let proc: ChildProcessLike | null = null;
  let desktopBin = '';

  beforeAll(async () => {
    const fs = (await nodeImport('node:fs')) as {
      existsSync(p: string): boolean;
      mkdtempSync(prefix: string): string;
      rmSync(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
    };
    const os = (await nodeImport('node:os')) as { tmpdir(): string };
    const { spawn } = (await nodeImport('node:child_process')) as {
      spawn(
        cmd: string,
        args: string[],
        opts: { cwd: string; env: Record<string, string | undefined>; stdio: 'pipe' }
      ): ChildProcessLike;
    };
    const { path, repoRoot, desktopBin: binPath } = await getPaths();
    desktopBin = binPath;

    if (!fs.existsSync(desktopBin)) {
      return;
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myamgi-rpc-test-'));
    port = await getFreePort();
    const envObj =
      (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ??
      {};

    proc = spawn(
      desktopBin,
      ['--seed', '--no-open', '--port', String(port), '--token', token, '--dir', tempDir],
      {
        cwd: repoRoot,
        env: { ...envObj, LC_ALL: 'C.UTF-8' },
        stdio: 'pipe',
      }
    );

    await waitForHostReady(proc, port, token, 30_000);

    const baseUrl = `http://127.0.0.1:${port}`;
    const headers = { 'X-Amgi-Token': token };
    configureAnkiRpc({ baseUrl, headers });
    configureHostApi({ baseUrl, headers });
  }, 40_000);

  afterAll(async () => {
    configureAnkiRpc({ baseUrl: '', headers: {} });
    configureHostApi({ baseUrl: '', headers: {} });

    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try {
            proc?.kill('SIGKILL');
          } catch {
            // Ignore kill errors
          }
          resolve();
        }, 3000);
        proc?.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }

    if (tempDir) {
      const fs = (await nodeImport('node:fs')) as {
        rmSync(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
      };
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('calls host.info() and verifies host metadata + auth enforcement', async () => {
    if (!proc) return;
    const info = await host.info();
    expect(info.platform).toBe('desktop');
    expect(info.backendVersion).toContain('26.09');
    expect(typeof info.eink).toBe('boolean');

    // Missing token is rejected with 403
    const unauth = await fetch(`http://127.0.0.1:${port}/api/host/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(unauth.status).toBe(403);
  });

  it('calls decks.deckTree() and verifies seeded Korean/Japanese/English decks with due counts', async () => {
    if (!proc) return;
    const tree = await decks.deckTree();
    const names = (tree.children ?? []).map((c) => c.name);
    expect(names).toContain('일본어');
    expect(names).toContain('영어');

    const jp = tree.children.find((c) => c.name === '일본어');
    expect(jp).toBeDefined();
    expect((jp?.newCount ?? 0) + (jp?.learnCount ?? 0) + (jp?.reviewCount ?? 0)).toBeGreaterThan(0);

    const flatNames = await decks.getDeckNames();
    expect(flatNames.some((d) => d.name === '일본어::한자')).toBe(true);
    expect(flatNames.some((d) => d.name === '일본어::어휘')).toBe(true);
  });

  it('calls scheduler.getQueuedCards(), renderExistingCard(), and extractAvTags()', async () => {
    if (!proc) return;
    const allDeckNames = await decks.getDeckNames();
    const vocabDeck = allDeckNames.find((d) => d.name === '일본어::어휘');
    expect(vocabDeck).toBeDefined();

    await decks.setCurrentDeck(toNumber(vocabDeck!.id));
    const queued = await scheduler.getQueuedCards(5);
    expect(queued.cards.length).toBeGreaterThan(0);

    const firstCard = queued.cards[0];
    const cardId = firstCard.card?.id;
    expect(cardId).toBeDefined();

    const rendered = await scheduler.renderExistingCard(cardId!);
    const qHtml = (rendered.questionNodes ?? [])
      .map((n) => n.text || n.replacement?.currentText || '')
      .join('');
    const aHtml = (rendered.answerNodes ?? [])
      .map((n) => n.text || n.replacement?.currentText || '')
      .join('');
    expect(qHtml.length).toBeGreaterThan(0);
    expect(aHtml.length).toBeGreaterThan(0);
    expect(rendered.css.length).toBeGreaterThan(0);

    const nextLabels = await scheduler.describeNextStates(firstCard.states!);
    expect(nextLabels).toHaveLength(4);

    const av = await scheduler.extractAvTags('단어 [sound:seed_tone_a.wav]', false);
    expect(av.text).toContain('단어');
    expect(av.avTags.length).toBe(1);
    expect(av.avTags[0].soundOrVideo).toBe('seed_tone_a.wav');

    // Verify notes wrapper works against live backend
    const noteId = firstCard.card?.noteId;
    expect(noteId).toBeDefined();
    const note = await notes.getNote(noteId!);
    expect(note.fields.length).toBeGreaterThanOrEqual(2);
  });

  it('calls search.searchCards(), notetypes.getNotetypeNames(), and stats.graphs()', async () => {
    if (!proc) return;
    const cardIds = await search.searchCards('deck:*');
    expect(cardIds.length).toBeGreaterThan(20);

    const kanjiCardIds = await search.searchCards('deck:"일본어::한자"');
    expect(kanjiCardIds.length).toBe(20);

    const ntNames = await notetypes.getNotetypeNames();
    expect(ntNames.length).toBeGreaterThanOrEqual(2);
    const firstNt = await notetypes.getNotetype(ntNames[0].id!);
    expect(firstNt.fields.length).toBeGreaterThan(0);

    const g = await stats.graphs('deck:*', 30);
    expect(g.cardCounts).toBeDefined();
    expect(g.today).toBeDefined();
    expect(g.buttons).toBeDefined();
  });

  it('surfaces typed AnkiError and HostApiError on invalid requests', async () => {
    if (!proc) return;
    await expect(decks.getDeck(987654321)).rejects.toBeInstanceOf(AnkiError);
    await expect(host.platformTts({ text: '안녕' })).rejects.toBeInstanceOf(HostApiError);
  });
});
