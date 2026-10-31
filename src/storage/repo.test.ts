import { clear } from 'idb-keyval';
import { beforeEach, describe, expect, test } from 'vitest';
import { setPortion, toggleItem } from '../domain/day';
import {
  exportAll,
  getOrCreateDay,
  importAll,
  listDays,
  loadPlan,
  localDateKey,
  saveDay,
  savePlan,
} from './repo';

beforeEach(async () => {
  await clear();
});

describe('localDateKey', () => {
  test('uses the local calendar date around midnight', () => {
    expect(localDateKey(new Date(2026, 9, 30, 23, 59))).toBe('2026-10-30');
    expect(localDateKey(new Date(2026, 9, 31, 0, 1))).toBe('2026-10-31');
    expect(localDateKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

describe('plan', () => {
  test('first load seeds the plan from the screenshots and saves it', async () => {
    const { plan, foods } = await loadPlan();
    expect(plan.meals).toHaveLength(6);
    expect(foods.length).toBe(21);
    const again = await loadPlan();
    expect(again.plan).toEqual(plan);
  });
});

describe('days', () => {
  test('getOrCreateDay returns the saved day with its edits', async () => {
    const day = await getOrCreateDay('2026-10-30');
    const edited = toggleItem(day, day.meals[0]!.items[0]!.id);
    await saveDay(edited);
    expect(await getOrCreateDay('2026-10-30')).toEqual(edited);
  });

  test('saving a new plan does not change an existing day', async () => {
    const day = await getOrCreateDay('2026-10-30');
    const { plan } = await loadPlan();
    await savePlan({ ...plan, goals: { ...plan.goals, kcal: 3000 } });
    expect((await getOrCreateDay('2026-10-30')).goals.kcal).toBe(3247);
    expect((await getOrCreateDay('2026-10-31')).goals.kcal).toBe(3000);
    expect(day.goals.kcal).toBe(3247);
  });

  test('listDays is newest first', async () => {
    await getOrCreateDay('2026-10-29');
    await getOrCreateDay('2026-10-31');
    await getOrCreateDay('2026-10-30');
    expect((await listDays()).map((d) => d.date)).toEqual(['2026-10-31', '2026-10-30', '2026-10-29']);
  });
});

describe('export / import', () => {
  test('round-trips everything', async () => {
    const day = await getOrCreateDay('2026-10-30');
    const c = day.meals[2]!.items[0]!;
    await saveDay(setPortion(day, c.id, { quantity: 200, unit: 'g' }));
    const file = await exportAll();
    expect(file.schemaVersion).toBe(1);
    await clear();
    await importAll(JSON.parse(JSON.stringify(file)));
    expect(await exportAll()).toEqual(file);
  });

  test('rejects an unsupported version and leaves data intact', async () => {
    await getOrCreateDay('2026-10-30');
    const before = await exportAll();
    await expect(importAll({ schemaVersion: 2 })).rejects.toThrow('Unsupported backup version');
    expect(await exportAll()).toEqual(before);
  });
});
