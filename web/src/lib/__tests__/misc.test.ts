import { afterEach, describe, expect, it, vi } from 'vitest';
import { host, HostError, prefsStore } from '../../host';
import { formatCount, formatWait } from '../format';
import { sanitizeHtml } from '../sanitize';
import { resolveTheme } from '../theme';

describe('sanitizeHtml', () => {
  it('drops scripts, handlers and unsafe URLs; keeps formatting', () => {
    const out = sanitizeHtml('<b>굵게</b><script>x()</script><img src=x onerror="y()"><a href="javascript:alert(1)">l</a><i onclick="z">i</i>');
    expect(out).toContain('<b>굵게</b>');
    expect(out).not.toMatch(/script|onerror|onclick|javascript/);
    expect(out).toContain('<img src="/media/x">');
    expect(out).toContain('<i>i</i>');
  });
  it('unwraps unknown tags but keeps their text', () => {
    expect(sanitizeHtml('<custom-el>안녕</custom-el>')).toBe('안녕');
  });
});

describe('resolveTheme', () => {
  it('follows pref, then e-ink device default, then system', () => {
    expect(resolveTheme('dark', null, false)).toBe('dark');
    expect(resolveTheme(undefined, { eink: true }, true)).toBe('eink');
    expect(resolveTheme('auto', { eink: true }, true)).toBe('dark');
    expect(resolveTheme(undefined, { eink: false }, false)).toBe('light');
  });
});

describe('format', () => {
  it('formats counts and waits in Korean', () => {
    expect(formatCount(1204)).toBe('1,204');
    expect(formatWait(45)).toBe('45초');
    expect(formatWait(600)).toBe('10분');
    expect(formatWait(5400)).toBe('1시간 30분');
  });
});

describe('host client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps host errors to HostError with the Korean message', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: '지원하지 않는 기능입니다', detail: 'sync.run' }), { status: 501 }));
    const err = await host.sync.run().catch((e) => e);
    expect(err).toBeInstanceOf(HostError);
    expect(err.message).toBe('지원하지 않는 기능입니다');
    expect(err.status).toBe(501);
    expect(err.detail).toBe('sync.run');
  });

  it('prefs: optimistic set persisted on the host, reverted on failure', async () => {
    const calls: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push([url, JSON.parse(String(init.body))]);
      return new Response('{}', { status: 200 });
    });
    prefsStore._reset({ theme: 'light' });
    await prefsStore.set({ theme: 'eink' });
    expect(prefsStore.get().theme).toBe('eink');
    expect(calls).toEqual([['/api/host/prefs.set', { theme: 'eink' }]]);

    vi.stubGlobal('fetch', async () => new Response('{"error":"x"}', { status: 500 }));
    await expect(prefsStore.set({ theme: 'dark' })).rejects.toBeInstanceOf(HostError);
    expect(prefsStore.get().theme).toBe('eink');
  });
});
