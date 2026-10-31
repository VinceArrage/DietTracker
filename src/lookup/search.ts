import type { Food } from '../domain/types';
import { normalizeOff, offSearchUrl } from './openFoodFacts';
import { normalizeUsda, usdaSearchUrl } from './usda';

export const SEARCH_TIMEOUT_MS = 8000;

type Source = 'off' | 'usda';
export type SearchError = { source: Source; message: string };
export type SearchResult = { results: Food[]; errors: SearchError[] };

const LABEL: Record<Source, string> = { off: 'Open Food Facts', usda: 'USDA' };

class TimedOut extends Error {}

/** Fetches JSON with its own timeout, while still honouring the caller's abort signal. */
async function fetchJson(url: string, signal: AbortSignal | undefined): Promise<unknown> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, SEARCH_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (timedOut) throw new TimedOut();
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function errorMessage(source: Source, reason: unknown): string {
  if (reason instanceof TimedOut) return `${LABEL[source]} timed out`;
  if (source === 'usda' && reason instanceof Error && reason.message === 'HTTP 429') {
    return 'USDA rate limit reached — add your free API key in Settings';
  }
  return `Couldn't reach ${LABEL[source]}`;
}

/** Searches both databases in parallel; one failing source never hides the other's results. */
export async function searchFoods(
  query: string,
  opts: { usdaKey: string | null; signal?: AbortSignal },
): Promise<SearchResult> {
  const q = query.trim();
  const [off, usda] = await Promise.allSettled([
    fetchJson(offSearchUrl(q), opts.signal).then(normalizeOff),
    fetchJson(usdaSearchUrl(q, opts.usdaKey), opts.signal).then(normalizeUsda),
  ]);
  if (opts.signal?.aborted) throw new DOMException('Search aborted', 'AbortError');

  const errors: SearchError[] = [];
  const pick = (source: Source, r: PromiseSettledResult<Food[]>): Food[] => {
    if (r.status === 'fulfilled') return r.value;
    console.warn(`Food search failed on ${source} for "${q}"`, r.reason);
    errors.push({ source, message: errorMessage(source, r.reason) });
    return [];
  };
  const offFoods = pick('off', off);
  const usdaFoods = pick('usda', usda);
  const genericWord = /^[\p{L}]+$/u.test(q);
  return { results: genericWord ? [...usdaFoods, ...offFoods] : [...offFoods, ...usdaFoods], errors };
}
