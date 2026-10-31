import { afterEach, describe, expect, test, vi } from 'vitest';
import offFixture from './__fixtures__/off-quinoa.json';
import usdaFixture from './__fixtures__/usda-banana.json';
import { normalizeOff } from './openFoodFacts';
import { searchFoods, SEARCH_TIMEOUT_MS } from './search';
import { normalizeUsda } from './usda';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('normalizeOff', () => {
  const foods = normalizeOff(offFixture);

  test('keeps products with kcal and drops those without', () => {
    expect(foods.map((f) => f.id)).toEqual(['off-68505101301', 'off-0068505103114']);
  });

  test('maps per-100 g nutrients, names with brand, missing sugar → 0', () => {
    const [grains, bread] = foods;
    expect(grains!.base).toMatchObject({ quantity: 100, unit: 'g' });
    expect(grains!.base.nutrients.kcal).toBeCloseTo(226.7, 1);
    expect(grains!.base.nutrients.sugar).toBe(0);
    expect(bread!.name).toBe('Pain biologique (St-Methode)');
    expect(bread!.source).toBe('off');
  });

  test('tolerates garbage input', () => {
    expect(normalizeOff(null)).toEqual([]);
    expect(normalizeOff({ hits: 'nope' })).toEqual([]);
  });
});

describe('normalizeUsda', () => {
  const foods = normalizeUsda(usdaFixture);

  test('maps nutrient numbers per 100 g', () => {
    const raw = foods.find((f) => f.id === 'usda-173944')!;
    expect(raw.name).toBe('Bananas, raw');
    expect(raw.base).toMatchObject({ quantity: 100, unit: 'g' });
    expect(raw.base.nutrients).toEqual({ kcal: 89, protein: 1.09, carbs: 22.8, fat: 0.33, fiber: 2.6, sugar: 12.2 });
  });

  test('turns food measures into gramsPerUnit', () => {
    expect(foods.find((f) => f.id === 'usda-173944')!.gramsPerUnit).toEqual({ '1 medium': 118 });
  });

  test('lists generic foods before branded products', () => {
    const kcal = [{ nutrientNumber: '208', value: 100 }];
    const mixed = normalizeUsda({
      foods: [
        { fdcId: 1, description: 'BANANA CHIPS', dataType: 'Branded', foodNutrients: kcal },
        { fdcId: 2, description: 'Bananas, raw', dataType: 'SR Legacy', foodNutrients: kcal },
        { fdcId: 3, description: 'Bananas, ripe', dataType: 'Foundation', foodNutrients: kcal },
      ],
    });
    expect(mixed.map((f) => f.id)).toEqual(['usda-2', 'usda-3', 'usda-1']);
  });

  test('missing sugar → 0', () => {
    expect(foods.find((f) => f.id === 'usda-1105073')!.base.nutrients.sugar).toBe(0);
  });
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe('searchFoods', () => {
  test('returns USDA results and an error entry when Open Food Facts fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('openfoodfacts') ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(json(usdaFixture)),
      ),
    );
    const r = await searchFoods('banana', { usdaKey: null });
    expect(r.results.length).toBe(3);
    expect(r.errors).toEqual([{ source: 'off', message: expect.any(String) }]);
  });

  test('uses DEMO_KEY when no USDA key is set, and the key when it is', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ foods: [], hits: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await searchFoods('egg', { usdaKey: null });
    await searchFoods('egg', { usdaKey: 'abc123' });
    const urls = fetchMock.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls.some((u) => u.includes('api_key=DEMO_KEY'))).toBe(true);
    expect(urls.some((u) => u.includes('api_key=abc123'))).toBe(true);
  });

  test('lists USDA first for one generic word, Open Food Facts first otherwise', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => Promise.resolve(json(url.includes('openfoodfacts') ? offFixture : usdaFixture))),
    );
    expect((await searchFoods('banana', { usdaKey: null })).results[0]!.source).toBe('usda');
    expect((await searchFoods('st methode', { usdaKey: null })).results[0]!.source).toBe('off');
  });

  test('an aborted search rejects with AbortError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) =>
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
          ),
      ),
    );
    const ctrl = new AbortController();
    const p = searchFoods('banana', { usdaKey: null, signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('a source that hangs times out into an error entry instead of hanging', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) =>
        url.includes('openfoodfacts')
          ? new Promise((_resolve, reject) =>
              init?.signal?.addEventListener('abort', () => reject(new DOMException('Timed out', 'TimeoutError'))),
            )
          : Promise.resolve(json(usdaFixture)),
      ),
    );
    const p = searchFoods('banana', { usdaKey: null });
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + 10);
    const r = await p;
    expect(r.results.length).toBe(3);
    expect(r.errors).toEqual([{ source: 'off', message: 'Open Food Facts timed out' }]);
  });
});
