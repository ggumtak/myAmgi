// Embeds an official Anki SvelteKit page (deck options, graphs, card info, ...)
// served by the host, in an iframe under the app bar.
//
// Theme handoff: the pages read Bootstrap's `data-bs-theme` and Anki's
// `night-mode` class on their <html>. The iframe is same-origin, so after every
// load (and whenever the app theme changes) we set both on the page's
// documentElement. For `eink` we also inject a stylesheet that removes colour,
// shadows and animation.
import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../lib/theme';
import { AppBar } from './AppBar';
import { LoadingState } from './Spinner';
import './OfficialPage.css';

const EINK_CSS = `
html, body { background: #fff !important; color: #000 !important; }
*, *::before, *::after { transition: none !important; animation: none !important; box-shadow: none !important; }
html { filter: grayscale(1) contrast(1.15); }
`;

export function applyThemeToDocument(doc: Document, theme: Theme): void {
  const root = doc.documentElement;
  const dark = theme === 'dark';
  root.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  root.classList.toggle('night-mode', dark);
  doc.body?.classList.toggle('nightMode', dark);
  let style = doc.getElementById('amgi-eink');
  if (theme === 'eink') {
    if (!style) {
      style = doc.createElement('style');
      style.id = 'amgi-eink';
      style.textContent = EINK_CSS;
      doc.head.appendChild(style);
    }
  } else {
    style?.remove();
  }
}

function currentTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || 'light';
}

export function OfficialPage({ title, src, back = true }: { title: string; src: string; back?: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
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

  const onLoad = () => {
    const doc = ref.current?.contentDocument;
    if (doc) applyThemeToDocument(doc, currentTheme());
    setLoaded(true);
  };

  return (
    <div className="screen official-page">
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
