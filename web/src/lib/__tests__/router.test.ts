import { describe, expect, it } from 'vitest';
import { compile, href, matchPath, parseHash } from '../router';
import { resolveRoute, routes } from '../../routes';

describe('parseHash', () => {
  it('splits path and query, normalizing slashes', () => {
    const l = parseHash('#/browse?q=deck%3A%22%EC%9D%BC%22');
    expect(l.path).toBe('/browse');
    expect(l.query.get('q')).toBe('deck:"일"');
    expect(parseHash('').path).toBe('/');
    expect(parseHash('#decks/').path).toBe('/decks');
    expect(parseHash('#//deck//5').path).toBe('/deck/5');
  });
});

describe('matchPath', () => {
  const c = compile([{ pattern: '/deck/:id' }, { pattern: '/files/*' }, { pattern: '/a' }]);
  it('captures params and rest', () => {
    expect(matchPath(c, '/deck/42')?.params).toEqual({ id: '42' });
    expect(matchPath(c, '/deck/%EC%98%81')?.params.id).toBe('영');
    expect(matchPath(c, '/files/x/y.apkg')?.params['*']).toBe('x/y.apkg');
    expect(matchPath(c, '/files')?.params['*']).toBe('');
    expect(matchPath(c, '/deck')).toBeNull();
    expect(matchPath(c, '/deck/1/2')).toBeNull();
    expect(matchPath(c, '/ab')).toBeNull();
  });
});

describe('app routes (UI_SPEC.md)', () => {
  const cases: [string, string, Record<string, string>?][] = [
    ['/', 'decks'],
    ['/decks', 'decks'],
    ['/deck/123', 'deck-overview', { id: '123' }],
    ['/study/123', 'study', { id: '123' }],
    ['/browse', 'browse'],
    ['/note/new', 'note-add'],
    ['/note/77', 'note-edit', { id: '77' }],
    ['/notetypes', 'notetypes'],
    ['/notetype/5', 'notetype', { id: '5' }],
    ['/stats', 'stats'],
    ['/deck-options/1', 'deck-options', { id: '1' }],
    ['/card-info/9', 'card-info', { id: '9' }],
    ['/import/apkg', 'import', { kind: 'apkg' }],
    ['/import/csv', 'import', { kind: 'csv' }],
    ['/change-notetype/3', 'change-notetype', { '*': '3' }],
    ['/image-occlusion/a.png', 'image-occlusion', { '*': 'a.png' }],
    ['/settings', 'settings'],
    ['/settings/sync', 'settings-sync'],
    ['/settings/backup', 'settings-backup'],
    ['/settings/about', 'settings-about'],
    ['/nope', 'not-found'],
  ];
  it.each(cases)('%s -> %s', (path, name, params) => {
    const r = resolveRoute(path);
    expect(r.route.name).toBe(name);
    if (params) expect(r.params).toEqual(params);
  });

  it('only the reviewer hides the shell chrome', () => {
    expect(routes.filter((r) => r.chrome === false).map((r) => r.name)).toEqual(['study']);
  });

  it('builds hrefs with encoded queries', () => {
    expect(href('/browse', { q: 'deck:일본어', empty: '' })).toBe('#/browse?q=deck%3A%EC%9D%BC%EB%B3%B8%EC%96%B4');
  });
});
