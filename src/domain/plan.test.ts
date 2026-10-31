import { describe, expect, test } from 'vitest';
import seed from '../data/plan.seed.json';
import { sumNutrients } from './nutrition';
import { planFromSeed, planItemNutrients } from './plan';

describe('planFromSeed', () => {
  const { plan, foods } = planFromSeed(seed);
  const foodMap = new Map(foods.map((f) => [f.id, f]));
  const allItems = plan.meals.flatMap((m) => m.items);

  test('loads 6 meals and 26 plan items', () => {
    expect(plan.meals).toHaveLength(6);
    expect(allItems).toHaveLength(26);
  });

  test('merges repeated foods into 21 distinct foods', () => {
    expect(foods).toHaveLength(21);
    const wheyItems = allItems.filter((i) => i.foodId === 'whey-isolate');
    expect(wheyItems).toHaveLength(3);
  });

  // Screenshot rows are rounded to 0.1, and merged foods are re-scaled from their
  // first row, so totals may drift by up to one rounding step.
  test('all items add up to the screenshot grand total', () => {
    const total = sumNutrients(allItems.map((i) => planItemNutrients(i, foodMap)));
    expect(Math.abs(total.kcal - 3246.4)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(total.protein - 304.0)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(total.carbs - 384.6)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(total.fat - 47.0)).toBeLessThanOrEqual(0.1);
  });

  test('a merged food scales to its other portion (meal 6 berries, 70 g)', () => {
    const berries = plan.meals[5]!.items.find((i) => i.foodId === 'mixed-berries')!;
    expect(berries.quantity).toBe(70);
    expect(planItemNutrients(berries, foodMap).kcal).toBeCloseTo(38.9, 1);
  });

  test('normalizes units and keeps stable ids', () => {
    expect(plan.meals[0]!.id).toBe('meal-1');
    expect(plan.meals[0]!.items[2]!.id).toBe('meal-1-item-3');
    expect(plan.meals[0]!.items[0]).toMatchObject({ quantity: 1, unit: 'scoop' });
    expect(plan.meals[0]!.items[3]).toMatchObject({ quantity: 2, unit: 'item' });
    expect(plan.meals[0]!.items[2]).toMatchObject({ quantity: 10, unit: 'g' });
  });

  test('keeps the meal 6 note and the goals', () => {
    expect(plan.meals[5]!.note).toBe('Ajoute 10g de Jello sans sucre pour y ajouter du goût');
    expect(plan.goals).toEqual({ kcal: 3247, protein: 304, carbs: 385, fat: 47, fiber: 11, sugar: 26 });
  });

  test('rejects malformed seed', () => {
    expect(() => planFromSeed({})).toThrow();
  });
});
