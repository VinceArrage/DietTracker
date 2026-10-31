import { beforeEach, describe, expect, test } from 'vitest';
import seed from '../data/plan.seed.json';
import { planFromSeed, type Plan } from './plan';
import type { Food } from './types';
import {
  addExtra,
  applyItemToPlan,
  createDay,
  dayTotals,
  editedFrom,
  itemNutrients,
  removeItem,
  replaceFood,
  setPortion,
  setSkipped,
  toggleItem,
  type DayLog,
} from './day';

let plan: Plan;
let foods: Map<string, Food>;
let day: DayLog;

const banana: Food = {
  id: 'usda-banana',
  name: 'Banana, raw',
  source: 'usda',
  base: { quantity: 100, unit: 'g', nutrients: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, sugar: 12.2 } },
};

beforeEach(() => {
  const loaded = planFromSeed(seed);
  plan = loaded.plan;
  foods = new Map([...loaded.foods, banana].map((f) => [f.id, f]));
  day = createDay('2026-10-30', plan);
});

const meal = (d: DayLog, n: number) => d.meals[n - 1]!;
const checkMeal = (d: DayLog, n: number) => meal(d, n).items.reduce((acc, it) => toggleItem(acc, it.id), d);
const checkAll = (d: DayLog) => d.meals.reduce((acc, _m, i) => checkMeal(acc, i + 1), d);
const chickenM3 = (d: DayLog) => meal(d, 3).items.find((i) => i.foodId === 'chicken-breast-cooked')!;

describe('createDay', () => {
  test('copies the plan with everything unchecked', () => {
    expect(day.date).toBe('2026-10-30');
    expect(day.meals).toHaveLength(6);
    expect(day.meals.every((m) => !m.skipped && m.items.every((i) => !i.checked))).toBe(true);
    expect(dayTotals(day, foods).eaten.kcal).toBe(0);
    expect(day.goals.kcal).toBe(3247);
  });

  test('deep-copies so editing the day never touches the plan', () => {
    meal(day, 1).items.pop();
    meal(day, 1).name = 'changed';
    day.goals.kcal = 1;
    expect(plan.meals[0]!.items).toHaveLength(8);
    expect(plan.meals[0]!.name).toBe('Meal 1 (pré-workout)');
    expect(plan.goals.kcal).toBe(3247);
  });
});

describe('checking items', () => {
  test('checking all of meal 1 eats 710.6 kcal', () => {
    expect(dayTotals(checkMeal(day, 1), foods).eaten.kcal).toBeCloseTo(710.6, 1);
  });

  test('toggling twice restores the totals and leaves the input unchanged', () => {
    const id = meal(day, 1).items[0]!.id;
    const once = toggleItem(day, id);
    expect(meal(day, 1).items[0]!.checked).toBe(false);
    expect(dayTotals(toggleItem(once, id), foods)).toEqual(dayTotals(day, foods));
  });
});

describe('skipping a meal', () => {
  test('skipped meal drops out of planned and eaten', () => {
    const checked = checkMeal(day, 4);
    const skipped = setSkipped(checked, 'meal-4', true);
    const t = dayTotals(skipped, foods);
    expect(t.planned.kcal).toBeCloseTo(3246.4 - 428.7, 0);
    expect(t.eaten.kcal).toBe(0);
    expect(dayTotals(setSkipped(skipped, 'meal-4', false), foods).eaten.kcal).toBeCloseTo(428.7, 1);
  });
});

describe('changing portions', () => {
  test('200 g chicken today: 302 kcal, marked edited, plan untouched', () => {
    const c = chickenM3(day);
    const edited = setPortion(day, c.id, { quantity: 200, unit: 'g' });
    const after = toggleItem(edited, c.id);
    expect(dayTotals(after, foods).eaten.kcal).toBeCloseTo(302.0, 1);
    expect(editedFrom(chickenM3(edited), plan)).toMatchObject({ quantity: 150, unit: 'g' });
    expect(editedFrom(chickenM3(day), plan)).toBeNull();
    expect(chickenM3(createDay('2026-10-31', plan)).quantity).toBe(150);
  });

  test('applyItemToPlan writes the change back without mutating the old plan', () => {
    const c = chickenM3(day);
    const edited = setPortion(day, c.id, { quantity: 200, unit: 'g' });
    const newPlan = applyItemToPlan(plan, edited, c.id);
    expect(newPlan.meals[2]!.items.find((i) => i.id === c.planItemId)!.quantity).toBe(200);
    expect(plan.meals[2]!.items.find((i) => i.id === c.planItemId)!.quantity).toBe(150);
    expect(chickenM3(createDay('2026-10-31', newPlan)).quantity).toBe(200);
  });

  test('replaceFood swaps the food and counts the new portion', () => {
    const rice = meal(day, 3).items.find((i) => i.foodId === 'basmati-riz')!;
    const swapped = toggleItem(replaceFood(day, rice.id, 'sweet-potatoes', { quantity: 250, unit: 'g' }), rice.id);
    expect(dayTotals(swapped, foods).eaten.kcal).toBeCloseTo(225, 1);
    expect(editedFrom(meal(swapped, 3).items.find((i) => i.id === rice.id)!, plan)).not.toBeNull();
  });

  test('removeItem drops the row from the day only', () => {
    const id = meal(day, 1).items[0]!.id;
    expect(meal(removeItem(day, id), 1).items).toHaveLength(7);
    expect(meal(day, 1).items).toHaveLength(8);
  });
});

describe('extras and totals', () => {
  test('an extra banana counts, defaults to checked, and is not "edited"', () => {
    const d = addExtra(day, 'meal-2', 'usda-banana', { quantity: 120, unit: 'g' });
    const extra = meal(d, 2).items.at(-1)!;
    expect(extra).toMatchObject({ planItemId: null, checked: true, foodId: 'usda-banana' });
    expect(dayTotals(d, foods).eaten.kcal).toBeCloseTo(106.8, 1);
    expect(editedFrom(extra, plan)).toBeNull();
  });

  test('eating past the goal reports remaining 0 and the amount over', () => {
    const extra = { ...banana, id: 'x', base: { ...banana.base, quantity: 1, unit: 'serving', nutrients: { ...banana.base.nutrients, kcal: 500 } } };
    foods.set('x', extra);
    const d = addExtra(checkAll(day), 'meal-6', 'x', { quantity: 1, unit: 'serving' });
    const t = dayTotals(d, foods);
    expect(t.remaining.kcal).toBe(0);
    expect(t.over.kcal).toBeCloseTo(3746.4 - 3247, 0);
  });

  test('remaining protein shows what is still needed', () => {
    const t = dayTotals(checkMeal(day, 1), foods);
    expect(t.remaining.protein).toBeCloseTo(304 - 57.7, 1);
    expect(t.over.protein).toBe(0);
  });

  test('item whose plan item was deleted still counts and is not "edited"', () => {
    const c = chickenM3(day);
    const shrunk: Plan = { ...plan, meals: plan.meals.map((m) => ({ ...m, items: m.items.filter((i) => i.id !== c.planItemId) })) };
    const d = toggleItem(day, c.id);
    expect(editedFrom(chickenM3(d), shrunk)).toBeNull();
    expect(dayTotals(d, foods).eaten.kcal).toBeCloseTo(226.5, 1);
  });
});

describe('itemNutrients', () => {
  test('a unit that cannot be converted counts as zero instead of throwing', () => {
    const row = { ...meal(day, 1).items[0]!, unit: 'g', quantity: 30 };
    expect(row.foodId).toBe('whey-isolate');
    expect(() => itemNutrients(row, foods)).not.toThrow();
    expect(itemNutrients(row, foods).kcal).toBe(0);
  });
});
