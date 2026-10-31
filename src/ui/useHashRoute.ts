import { useEffect, useState } from 'react';

export type Route =
  | { name: 'today' }
  | { name: 'plan' }
  | { name: 'history' }
  | { name: 'day'; date: string }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const day = /^\/history\/(\d{4}-\d{2}-\d{2})$/.exec(path);
  if (day) return { name: 'day', date: day[1]! };
  if (path === '/plan') return { name: 'plan' };
  if (path === '/history') return { name: 'history' };
  if (path === '/settings') return { name: 'settings' };
  return { name: 'today' };
}

/** Minimal hash router: `#/today`, `#/plan`, `#/history`, `#/history/<date>`, `#/settings`. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
