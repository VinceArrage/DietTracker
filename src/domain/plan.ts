import { z } from 'zod';
import { portionNutrients } from './nutrition';
import type { Food, Nutrients, Portion } from './types';

export type PlanItem = { id: string; foodId: string } & Portion;
export type Meal = { id: string; name: string; note: string | null; items: PlanItem[] };
export type Goals = Nutrients;
export type Plan = { meals: Meal[]; goals: Goals };

const num = z.number().finite().nonnegative();
const nutrientsShape = { kcal: num, protein: num, carbs: num, fat: num, fiber: num, sugar: num };

export const SeedSchema = z.object({
  schemaVersion: z.literal(1),
  goals: z.object(nutrientsShape),
  meals: z
    .array(
      z.object({
        name: z.string().min(1),
        note: z.string().nullable(),
        items: z.array(
          z.object({ name: z.string().min(1), quantity: z.number().positive(), unit: z.string().min(1), ...nutrientsShape }),
        ),
      }),
    )
    .min(1),
});

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const UNIT_ALIASES: Record<string, string> = { g: 'g', gram: 'g', grams: 'g', item: 'item', items: 'item' };

export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase();
  return UNIT_ALIASES[u] ?? u;
}

/** Builds the plan and its de-duplicated foods from the transcribed screenshot file. */
export function planFromSeed(seed: unknown): { plan: Plan; foods: Food[] } {
  const parsed = SeedSchema.parse(seed);
  const foods = new Map<string, Food>();

  const meals: Meal[] = parsed.meals.map((meal, mi) => {
    const mealId = `meal-${mi + 1}`;
    return {
      id: mealId,
      name: meal.name,
      note: meal.note,
      items: meal.items.map((row, ii) => {
        const foodId = slugify(row.name);
        const unit = normalizeUnit(row.unit);
        if (!foods.has(foodId)) {
          const { name, quantity, kcal, protein, carbs, fat, fiber, sugar } = row;
          foods.set(foodId, {
            id: foodId,
            name,
            source: 'plan',
            base: { quantity, unit, nutrients: { kcal, protein, carbs, fat, fiber, sugar } },
          });
        }
        return { id: `${mealId}-item-${ii + 1}`, foodId, quantity: row.quantity, unit };
      }),
    };
  });

  return { plan: { meals, goals: parsed.goals }, foods: [...foods.values()] };
}

export function planItemNutrients(item: PlanItem, foods: Map<string, Food>): Nutrients {
  const food = foods.get(item.foodId);
  if (!food) throw new Error(`Unknown food "${item.foodId}" in plan item ${item.id}`);
  return portionNutrients(food, item);
}
