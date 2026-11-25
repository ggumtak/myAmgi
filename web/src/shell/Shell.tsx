// App shell: bottom tab bar (< 900px) or navigation rail (>= 900px) around the
// current screen. The reviewer hides both.
import { useRef, useState, type ReactNode } from 'react';
import type { Tab } from '../routes';
import { useWide } from '../lib/hooks';
import { IconDecks, IconPlus, IconSearch, IconSettings, IconStats } from '../ui/icons';
import type { MenuAnchor } from '../ui/Menu';
import { AddMenu } from './AddMenu';
import './Shell.css';

const TABS: { tab: Tab; label: string; href: string; icon: ReactNode }[] = [
  { tab: 'decks', label: '덱', href: '#/decks', icon: <IconDecks /> },
  { tab: 'browse', label: '찾아보기', href: '#/browse', icon: <IconSearch /> },
  { tab: 'stats', label: '통계', href: '#/stats', icon: <IconStats /> },
  { tab: 'settings', label: '설정', href: '#/settings', icon: <IconSettings /> },
];

export function Shell({ tab, chrome = true, children }: { tab?: Tab; chrome?: boolean; children: ReactNode }) {
  const wide = useWide();
  const addRef = useRef<HTMLButtonElement>(null);
  const [addAnchor, setAddAnchor] = useState<MenuAnchor | null>(null);

  if (!chrome) return <div className="shell shell--bare">{children}</div>;

  if (wide) {
    return (
      <div className="shell shell--wide">
        <nav className="rail" aria-label="주 메뉴">
          <button
            ref={addRef}
            type="button"
            className="rail__add"
            aria-label="추가"
            data-testid="rail-add"
            onClick={() => setAddAnchor(addRef.current!.getBoundingClientRect())}
          >
            <IconPlus />
            <span className="rail__add-label">추가</span>
          </button>
          {TABS.map((t) => (
            <a key={t.tab} href={t.href} className={`rail__item ${tab === t.tab ? 'is-active' : ''}`} aria-current={tab === t.tab ? 'page' : undefined}>
              <span className="rail__icon">{t.icon}</span>
              <span className="rail__label">{t.label}</span>
            </a>
          ))}
        </nav>
        <main className="shell__content">{children}</main>
        <AddMenu open={!!addAnchor} anchor={addAnchor && railMenuAnchor(addAnchor)} onClose={() => setAddAnchor(null)} />
      </div>
    );
  }

  return (
    <div className="shell shell--narrow">
      <main className="shell__content">{children}</main>
      <nav className="tabbar" aria-label="주 메뉴">
        {TABS.map((t) => (
          <a key={t.tab} href={t.href} className={`tabbar__item ${tab === t.tab ? 'is-active' : ''}`} aria-current={tab === t.tab ? 'page' : undefined}>
            <span className="tabbar__icon">{t.icon}</span>
            <span className="tabbar__label">{t.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

/** Rail menu opens to the right of the button. */
function railMenuAnchor(a: MenuAnchor): MenuAnchor {
  return 'width' in a ? { x: a.right + 8, y: a.top } : a;
}
