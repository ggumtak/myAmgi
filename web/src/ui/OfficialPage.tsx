// Embeds an official Anki SvelteKit page (deck options, graphs, card info,
// congrats, import, ...) served by the host, in an iframe under the app bar.
//
// Theme handoff: the pages style themselves from Anki's `night-mode` class and
// Bootstrap's `data-bs-theme` on their <html>. The iframe is same-origin, so after
// every load (and whenever the app theme changes) both are set on the page's
// documentElement, together with the app's UI font. `eink` = the light theme plus an injected stylesheet that turns
// Anki's colour variables black/white and removes shadows and animation.
//
// Closing: when the page makes a frontend-service call the host emits `anki-page`
// `{method, close}`. `close: true` (e.g. deck options saved) closes the page.
import { useEffect, useRef, useState } from 'react';
import { onHostEvent, type AnkiPageEvent } from '../host';
import { goBack } from '../lib/back';
import type { Theme } from '../lib/theme';
import { AppBar } from './AppBar';
import { LoadingState } from './Spinner';
import './OfficialPage.css';

const EINK_CSS = `
:root, :root.night-mode {
  --fg: #000 !important; --fg-subtle: #000 !important; --fg-faint: #000 !important; --fg-disabled: #555 !important; --fg-link: #000 !important;
  --canvas: #fff !important; --canvas-elevated: #fff !important; --canvas-inset: #fff !important; --canvas-code: #fff !important;
  --canvas-overlay: #fff !important; --canvas-glass: #fff !important;
  --border: #000 !important; --border-subtle: #000 !important; --border-strong: #000 !important; --border-focus: #000 !important;
  --button-bg: #fff !important; --button-gradient-start: #fff !important; --button-gradient-end: #fff !important;
  --button-hover-border: #000 !important; --button-primary-bg: #000 !important;
  --button-primary-gradient-start: #000 !important; --button-primary-gradient-end: #000 !important;
  --shadow: none !important; --shadow-subtle: none !important; --shadow-inset: none !important; --shadow-focus: none !important;
  --bs-body-color: #000 !important; --bs-body-bg: #fff !important; --bs-border-color: #000 !important;
}
html, body { background: #fff !important; color: #000 !important; }
html { filter: grayscale(1) contrast(1.2); }
a { color: #000 !important; text-decoration: underline !important; }
*, *::before, *::after { transition: none !important; animation: none !important; box-shadow: none !important; text-shadow: none !important; }
`;

/** Anki desktop gives its pages the system UI font; without it they fall back to a serif font. */
const BASE_CSS = `
body { font-family: system-ui, 'Noto Sans KR', sans-serif; }
input, select, button, textarea { font-family: inherit; }
`;

export function applyThemeToDocument(doc: Document, theme: Theme): void {
  if (!doc.getElementById('amgi-base')) {
    const base = doc.createElement('style');
    base.id = 'amgi-base';
    base.textContent = BASE_CSS;
    (doc.head ?? doc.documentElement).appendChild(base);
  }
  const root = doc.documentElement;
  const dark = theme === 'dark';
  root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  root.classList.toggle('night-mode', dark);
  root.dataset.amgiTheme = theme;
  doc.body?.classList.toggle('nightMode', dark);
  let style = doc.getElementById('amgi-eink');
  if (theme === 'eink') {
    if (!style) {
      style = doc.createElement('style');
      style.id = 'amgi-eink';
      style.textContent = EINK_CSS;
      (doc.head ?? root).appendChild(style);
    }
  } else {
    style?.remove();
  }
}

function currentTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || 'light';
}

export interface OfficialPageProps {
  title: string;
  /** Page URL on the host, e.g. `/deck-options/1`. */
  src: string;
  /** Show the back arrow (default true). */
  back?: boolean;
  /** Every `anki-page` event while this page is open. */
  onAnkiEvent?: (ev: AnkiPageEvent) => void;
  /** Called once when the page asks to close; default: go back. */
  onClose?: (ev: AnkiPageEvent) => void;
}

export function OfficialPage({ title, src, back = true, onAnkiEvent, onClose }: OfficialPageProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const closed = useRef(false);
  const handlers = useRef({ onAnkiEvent, onClose });
  handlers.current = { onAnkiEvent, onClose };

  useEffect(() => {
    setLoaded(false);
    closed.current = false;
  }, [src]);

  // Follow app theme changes while the page is open.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const doc = ref.current?.contentDocument;
      if (doc) applyThemeToDocument(doc, currentTheme());
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(
    () =>
      onHostEvent('anki-page', (ev) => {
        handlers.current.onAnkiEvent?.(ev);
        if (!ev.close || closed.current) return;
        closed.current = true;
        (handlers.current.onClose ?? goBack)(ev);
      }),
    [],
  );

  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    if (doc) applyThemeToDocument(doc, currentTheme());
    setLoaded(true);
  };

  return (
    <div className="screen official-page" data-testid="official-page" data-src={src}>
      <AppBar title={title} back={back} />
      <div className="official-page__frame-wrap">
        {!loaded && (
          <div className="official-page__loading">
            <LoadingState />
          </div>
        )}
        <iframe
          ref={ref}
          key={src}
          className="official-page__frame"
          src={src}
          title={title}
          onLoad={onLoad}
          data-testid="official-frame"
        />
      </div>
    </div>
  );
}
