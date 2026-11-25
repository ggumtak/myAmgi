// Allowlist HTML sanitizer for deck descriptions (shown inside the app UI, not
// in the isolated card frame). Drops scripts, event handlers, and unsafe URLs.

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'br', 'p', 'div', 'span', 'ul', 'ol', 'li',
  'blockquote', 'code', 'pre', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr',
  'td', 'th', 'font', 'small', 'big', 'mark', 'ruby', 'rt', 'rp',
]);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'link', 'meta']);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
  img: new Set(['src', 'alt', 'width', 'height']),
  font: new Set(['color']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
};

function safeUrl(value: string, forImage: boolean): string | null {
  const v = value.trim();
  if (/^(https?:|mailto:)/i.test(v)) return v;
  if (forImage && /^data:image\/(png|gif|jpe?g|webp);/i.test(v)) return v;
  // Relative references are media files of the collection.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && !v.startsWith('//')) {
    return forImage ? `/media/${v.replace(/^\/+/, '')}` : null;
  }
  return null;
}

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]*>/g, '');
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        if (DROP_WITH_CONTENT.has(tag)) {
          el.remove();
          continue;
        }
        clean(el);
        if (!ALLOWED_TAGS.has(tag)) {
          el.replaceWith(...Array.from(el.childNodes));
          continue;
        }
        const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (!allowed.has(name)) {
            el.removeAttribute(attr.name);
            continue;
          }
          if (name === 'href' || name === 'src') {
            const url = safeUrl(attr.value, name === 'src');
            if (url === null) el.removeAttribute(attr.name);
            else el.setAttribute(attr.name, url);
          }
        }
        if (tag === 'a') {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    }
  };
  clean(doc.body);
  return doc.body.innerHTML;
}
