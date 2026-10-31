import { clear, delMany, get, getMany, keys, set, setMany } from 'idb-keyval';
import { z } from 'zod';
import seed from '../data/plan.seed.json';
import { createDay, type DayLog } from '../domain/day';
import { planFromSeed, type Plan } from '../domain/plan';
import type { Food } from '../domain/types';

export type Settings = { usdaKey: string | null };
export type ExportFile = { schemaVersion: 1; plan: Plan; foods: Food[]; days: DayLog[]; settings: Settings };

const DEFAULT_SETTINGS: Settings = { usdaKey: null };
const DAY_PREFIX = 'day:';

const num = z.number().finite();
const NutrientsSchema = z.object({ kcal: num, protein: num, carbs: num, fat: num, fiber: num, sugar: num });
const PortionShape = { quantity: num.nonnegative(), unit: z.string().min(1) };
const FoodSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  source: z.enum(['plan', 'off', 'usda', 'manual']),
  base: z.object({ quantity: num.positive(), unit: z.string().min(1), nutrients: NutrientsSchema }),
  gramsPerUnit: z.record(z.string(), num.positive()).optional(),
});
const PlanSchema = z.object({
  goals: NutrientsSchema,
  meals: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      note: z.string().nullable(),
      items: z.array(z.object({ id: z.string(), foodId: z.string(), ...PortionShape })),
    }),
  ),
});
const DaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  goals: NutrientsSchema,
  meals: z.array(
    z.object({
      planMealId: z.string(),
      name: z.string(),
      note: z.string().nullable(),
      skipped: z.boolean(),
      items: z.array(
        z.object({ id: z.string(), planItemId: z.string().nullable(), foodId: z.string(), checked: z.boolean(), ...PortionShape }),
      ),
    }),
  ),
});
const ExportSchema = z.object({
  schemaVersion: z.literal(1),
  plan: PlanSchema,
  foods: z.array(FoodSchema),
  days: z.array(DaySchema),
  settings: z.object({ usdaKey: z.string().nullable() }),
});

/** Local calendar date as YYYY-MM-DD (never UTC). */
export function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function loadPlan(): Promise<{ plan: Plan; foods: Food[] }> {
  const [plan, foods] = await Promise.all([get<Plan>('plan'), get<Food[]>('foods')]);
  if (plan && foods) return { plan, foods };
  const seeded = planFromSeed(seed);
  await setMany([
    ['plan', seeded.plan],
    ['foods', seeded.foods],
  ]);
  return seeded;
}

export async function savePlan(plan: Plan): Promise<void> {
  await set('plan', plan);
}

export async function loadFoods(): Promise<Map<string, Food>> {
  const { foods } = await loadPlan();
  return new Map(foods.map((f) => [f.id, f]));
}

export async function saveFood(food: Food): Promise<void> {
  const { foods } = await loadPlan();
  await set('foods', [...foods.filter((f) => f.id !== food.id), food]);
}

export async function getOrCreateDay(date: string): Promise<DayLog> {
  const existing = await get<DayLog>(DAY_PREFIX + date);
  if (existing) return existing;
  const { plan } = await loadPlan();
  const day = createDay(date, plan);
  await saveDay(day);
  return day;
}

export async function saveDay(day: DayLog): Promise<void> {
  await set(DAY_PREFIX + day.date, day);
}

export async function listDays(): Promise<DayLog[]> {
  const dayKeys = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(DAY_PREFIX));
  const days = (await getMany<DayLog | undefined>(dayKeys)).filter((d): d is DayLog => d !== undefined);
  return days.sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadSettings(): Promise<Settings> {
  return (await get<Settings>('settings')) ?? { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await set('settings', settings);
}

export async function exportAll(): Promise<ExportFile> {
  const { plan, foods } = await loadPlan();
  return { schemaVersion: 1, plan, foods, days: await listDays(), settings: await loadSettings() };
}

/** Replaces all data with a backup. Validates first, so a bad file changes nothing. */
export async function importAll(file: unknown): Promise<void> {
  const version = (file as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version !== 1) throw new Error('Unsupported backup version');
  const parsed = ExportSchema.safeParse(file);
  if (!parsed.success) throw new Error('Invalid backup file');
  const data = parsed.data;
  const entries: [string, unknown][] = [
    ['plan', data.plan],
    ['foods', data.foods],
    ['settings', data.settings],
    ...data.days.map((d): [string, DayLog] => [DAY_PREFIX + d.date, d]),
  ];
  // Write the backup first, then drop leftovers, so a failed write never leaves the store empty.
  await setMany(entries);
  const keep = new Set(entries.map(([k]) => k));
  await delMany((await keys()).filter((k) => !keep.has(String(k))));
}

/** Deletes every day and setting; the original plan is re-seeded on next load. */
export async function resetAll(): Promise<void> {
  await clear();
}
