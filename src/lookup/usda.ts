import type { Food, Nutrients } from '../domain/types';

export const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

/** USDA nutrient numbers; Foundation foods may report sugar as 269.3. */
const NUTRIENT_NUMBERS: Record<string, keyof Nutrients> = {
  '208': 'kcal',
  '203': 'protein',
  '205': 'carbs',
  '204': 'fat',
  '291': 'fiber',
  '269': 'sugar',
  '269.3': 'sugar',
};

type UsdaFood = {
  fdcId?: unknown;
  description?: unknown;
  dataType?: unknown;
  foodNutrients?: { nutrientNumber?: unknown; value?: unknown }[];
  foodMeasures?: { disseminationText?: unknown; gramWeight?: unknown }[];
};

/** USDA FoodData Central search results → foods per 100 g. Foods without kcal are dropped. */
export function normalizeUsda(json: unknown): Food[] {
  const foods = (json as { foods?: unknown } | null)?.foods;
  if (!Array.isArray(foods)) return [];
  // Branded products often outrank plain foods for generic queries; list them last.
  const ordered = [...(foods as UsdaFood[])].sort((a, b) => Number(a.dataType === 'Branded') - Number(b.dataType === 'Branded'));
  return ordered.flatMap((f) => {
    if (typeof f.fdcId !== 'number' || typeof f.description !== 'string') return [];
    const nutrients: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
    for (const fn of f.foodNutrients ?? []) {
      const key = typeof fn.nutrientNumber === 'string' ? NUTRIENT_NUMBERS[fn.nutrientNumber] : undefined;
      if (key && typeof fn.value === 'number' && Number.isFinite(fn.value)) nutrients[key] = fn.value;
    }
    if (nutrients.kcal <= 0) return [];
    const gramsPerUnit: Record<string, number> = {};
    for (const m of f.foodMeasures ?? []) {
      if (typeof m.disseminationText === 'string' && typeof m.gramWeight === 'number' && m.gramWeight > 0) {
        gramsPerUnit[m.disseminationText] = m.gramWeight;
      }
    }
    const food: Food = {
      id: `usda-${f.fdcId}`,
      name: f.description,
      source: 'usda',
      base: { quantity: 100, unit: 'g', nutrients },
    };
    if (Object.keys(gramsPerUnit).length > 0) food.gramsPerUnit = gramsPerUnit;
    return [food];
  });
}

export function usdaSearchUrl(query: string, apiKey: string | null): string {
  const params = new URLSearchParams({
    query,
    pageSize: '15',
    dataType: 'Foundation,SR Legacy,Branded',
    api_key: apiKey?.trim() || 'DEMO_KEY',
  });
  return `${USDA_SEARCH_URL}?${params}`;
}
