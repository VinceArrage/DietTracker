import { UnitError, ZERO, portionNutrients, sumNutrients } from './nutrition';
import type { Goals, Plan, PlanItem } from './plan';
import { NUTRIENT_KEYS, type Food, type Nutrients, type Portion } from './types';

/** One row of a day. `planItemId` is null for extras added that day. */
export type DayItem = { id: string; planItemId: string | null; foodId: string; checked: boolean } & Portion;
export type DayMeal = { planMealId: string; name: string; note: string | null; skipped: boolean; items: DayItem[] };
export type DayLog = { date: string; goals: Goals; meals: DayMeal[] };
export type DayTotals = { eaten: Nutrients; planned: Nutrients; remaining: Nutrients; over: Nutrients };

/** Copies the plan into a new, fully editable day. */
export function createDay(date: string, plan: Plan): DayLog {
  return {
    date,
    goals: { ...plan.goals },
    meals: plan.meals.map((m) => ({
      planMealId: m.id,
      name: m.name,
      note: m.note,
      skipped: false,
      items: m.items.map((i) => ({
        id: i.id,
        planItemId: i.id,
        foodId: i.foodId,
        quantity: i.quantity,
        unit: i.unit,
        checked: false,
      })),
    })),
  };
}

function mapItem(day: DayLog, itemId: string, fn: (item: DayItem) => DayItem | null): DayLog {
  return {
    ...day,
    meals: day.meals.map((m) => {
      if (!m.items.some((i) => i.id === itemId)) return m;
      return { ...m, items: m.items.flatMap((i) => (i.id === itemId ? (fn(i) ?? []) : [i])) };
    }),
  };
}

export function toggleItem(day: DayLog, itemId: string): DayLog {
  return mapItem(day, itemId, (i) => ({ ...i, checked: !i.checked }));
}

export function setPortion(day: DayLog, itemId: string, portion: Portion): DayLog {
  return mapItem(day, itemId, (i) => ({ ...i, quantity: portion.quantity, unit: portion.unit }));
}

export function replaceFood(day: DayLog, itemId: string, foodId: string, portion: Portion): DayLog {
  return mapItem(day, itemId, (i) => ({ ...i, foodId, quantity: portion.quantity, unit: portion.unit }));
}

export function removeItem(day: DayLog, itemId: string): DayLog {
  return mapItem(day, itemId, () => null);
}

export function addExtra(day: DayLog, mealId: string, foodId: string, portion: Portion, checked = true): DayLog {
  const item: DayItem = {
    id: `extra-${crypto.randomUUID()}`,
    planItemId: null,
    foodId,
    quantity: portion.quantity,
    unit: portion.unit,
    checked,
  };
  return {
    ...day,
    meals: day.meals.map((m) => (m.planMealId === mealId ? { ...m, items: [...m.items, item] } : m)),
  };
}

export function setSkipped(day: DayLog, mealId: string, skipped: boolean): DayLog {
  return { ...day, meals: day.meals.map((m) => (m.planMealId === mealId ? { ...m, skipped } : m)) };
}

export function itemNutrients(item: DayItem, foods: Map<string, Food>): Nutrients {
  const food = foods.get(item.foodId);
  if (!food) return { ...ZERO };
  try {
    return portionNutrients(food, item);
  } catch (e) {
    // Inconsistent data (e.g. an old or hand-edited backup) must not take the whole screen down.
    if (!(e instanceof UnitError)) throw e;
    console.warn(`Row ${item.id} counted as 0: ${e.message}`);
    return { ...ZERO };
  }
}

export function dayTotals(day: DayLog, foods: Map<string, Food>): DayTotals {
  const active = day.meals.filter((m) => !m.skipped).flatMap((m) => m.items);
  const planned = sumNutrients(active.map((i) => itemNutrients(i, foods)));
  const eaten = sumNutrients(active.filter((i) => i.checked).map((i) => itemNutrients(i, foods)));
  const remaining = { ...ZERO };
  const over = { ...ZERO };
  for (const k of NUTRIENT_KEYS) {
    remaining[k] = Math.max(0, day.goals[k] - eaten[k]);
    over[k] = Math.max(0, eaten[k] - day.goals[k]);
  }
  return { eaten, planned, remaining, over };
}

/** True when the row still has a matching item in the plan (false for extras and orphaned rows). */
export function hasPlanItem(item: DayItem, plan: Plan): boolean {
  return item.planItemId !== null && findPlanItem(plan, item.planItemId) !== undefined;
}

function findPlanItem(plan: Plan, planItemId: string): PlanItem | undefined {
  for (const m of plan.meals) {
    const found = m.items.find((i) => i.id === planItemId);
    if (found) return found;
  }
  return undefined;
}

/** The plan item this row came from, when today's row differs from it; otherwise null. */
export function editedFrom(item: DayItem, plan: Plan): PlanItem | null {
  if (item.planItemId === null) return null;
  const original = findPlanItem(plan, item.planItemId);
  if (!original) return null;
  const same = original.foodId === item.foodId && original.quantity === item.quantity && original.unit === item.unit;
  return same ? null : original;
}

/** "Also update my plan": copies a day row's food and portion onto its plan item. */
export function applyItemToPlan(plan: Plan, day: DayLog, itemId: string): Plan {
  const item = day.meals.flatMap((m) => m.items).find((i) => i.id === itemId);
  if (!item?.planItemId) return plan;
  const target = item.planItemId;
  return {
    ...plan,
    meals: plan.meals.map((m) => ({
      ...m,
      items: m.items.map((i) =>
        i.id === target ? { ...i, foodId: item.foodId, quantity: item.quantity, unit: item.unit } : i,
      ),
    })),
  };
}
