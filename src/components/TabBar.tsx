import type { Route } from '../ui/useHashRoute';

const TABS = [
  { href: '#/today', label: 'Today', icon: '✓', match: ['today'] },
  { href: '#/plan', label: 'Plan', icon: '☰', match: ['plan'] },
  { href: '#/history', label: 'History', icon: '◷', match: ['history', 'day'] },
  { href: '#/settings', label: 'Settings', icon: '⚙', match: ['settings'] },
] as const;

export function TabBar({ route }: { route: Route }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((t) => {
        const active = (t.match as readonly string[]).includes(route.name);
        return (
          <a key={t.href} href={t.href} className={`tab ${active ? 'tab--active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span aria-hidden="true" className="tab__icon">
              {t.icon}
            </span>
            <span>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
