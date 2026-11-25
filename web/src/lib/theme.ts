import type { HostInfo, ThemePref } from '../host';

export type Theme = 'light' | 'dark' | 'eink';

/** The theme to use: explicit pref, else `eink` on e-ink devices, else system. */
export function resolveTheme(pref: ThemePref | undefined, info: Pick<HostInfo, 'eink'> | null, systemDark: boolean): Theme {
  const p = pref ?? (info?.eink ? 'eink' : 'auto');
  if (p === 'auto') return systemDark ? 'dark' : 'light';
  return p;
}

const THEME_COLOR: Record<Theme, string> = { light: '#FFFFFF', dark: '#121316', eink: '#FFFFFF' };

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', THEME_COLOR[theme]);
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}
