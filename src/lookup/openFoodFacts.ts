import type { Food } from '../domain/types';

export const OFF_SEARCH_URL = 'https://search.openfoodfacts.org/search';

type OffHit = {
  code?: unknown;
  product_name?: unknown;
  brands?: unknown;
  nutriments?: Record<string, unknown>;
};

const numOr0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function brandText(brands: unknown): string {
  if (Array.isArray(brands)) return brands.filter((b) => typeof b === 'string').join(', ');
  return typeof brands === 'string' ? brands : '';
}

/** Open Food Facts search hits → foods per 100 g. Hits without kcal are dropped. */
export function normalizeOff(json: unknown): Food[] {
  const hits = (json as { hits?: unknown } | null)?.hits;
  if (!Array.isArray(hits)) return [];
  return (hits as OffHit[]).flatMap((hit) => {
    const n = hit.nutriments ?? {};
    const kcal = n['energy-kcal_100g'];
    if (typeof hit.code !== 'string' || typeof kcal !== 'number' || kcal <= 0) return [];
    const product = typeof hit.product_name === 'string' && hit.product_name.trim() ? hit.product_name.trim() : 'Unnamed product';
    const brand = brandText(hit.brands);
    return [
      {
        id: `off-${hit.code}`,
        name: brand ? `${product} (${brand})` : product,
        source: 'off' as const,
        base: {
          quantity: 100,
          unit: 'g',
          nutrients: {
            kcal,
            protein: numOr0(n['proteins_100g']),
            carbs: numOr0(n['carbohydrates_100g']),
            fat: numOr0(n['fat_100g']),
            fiber: numOr0(n['fiber_100g']),
            sugar: numOr0(n['sugars_100g']),
          },
        },
      },
    ];
  });
}

export function offSearchUrl(query: string): string {
  const params = new URLSearchParams({ q: query, page_size: '15', fields: 'code,product_name,brands,nutriments' });
  return `${OFF_SEARCH_URL}?${params}`;
}
