import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dayTotals, type DayLog, type DayTotals } from '../domain/day';
import type { Plan } from '../domain/plan';
import type { Food } from '../domain/types';
import { getOrCreateDay, loadPlan, localDateKey, saveDay, saveFood, savePlan as persistPlan } from '../storage/repo';

export type TodayState = {
  day: DayLog | null;
  plan: Plan | null;
  foods: Map<string, Food>;
  totals: DayTotals | null;
  error: string | null;
  update: (fn: (d: DayLog) => DayLog) => void;
  addFood: (food: Food) => Promise<void>;
  savePlan: (plan: Plan) => Promise<void>;
};

/** Loads today's editable day and keeps it in sync with storage and the calendar date. */
export function useToday(): TodayState {
  const [day, setDay] = useState<DayLog | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [foods, setFoods] = useState<Map<string, Food>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const dayRef = useRef<DayLog | null>(null);

  const load = useCallback(async () => {
    try {
      const key = localDateKey(new Date());
      if (dayRef.current?.date === key) return;
      const loaded = await loadPlan();
      const today = await getOrCreateDay(key);
      dayRef.current = today;
      setPlan(loaded.plan);
      setFoods(new Map(loaded.foods.map((f) => [f.id, f])));
      setDay(today);
    } catch (e) {
      console.error('Failed to load today', e);
      setError('Could not load your data.');
    }
  }, []);

  useEffect(() => {
    // Initial load from IndexedDB; state is set once the async read resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onWake = () => {
      if (document.visibilityState !== 'hidden') void load();
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, [load]);

  const update = useCallback((fn: (d: DayLog) => DayLog) => {
    const current = dayRef.current;
    if (!current) return;
    const next = fn(current);
    dayRef.current = next;
    setDay(next);
    saveDay(next).catch((e: unknown) => {
      console.error(`Failed to save day ${next.date}`, e);
      setError('Could not save your change.');
    });
  }, []);

  const addFood = useCallback(async (food: Food) => {
    await saveFood(food);
    setFoods((prev) => new Map(prev).set(food.id, food));
  }, []);

  const savePlan = useCallback(async (next: Plan) => {
    await persistPlan(next);
    setPlan(next);
  }, []);

  const totals = useMemo(() => (day ? dayTotals(day, foods) : null), [day, foods]);

  return { day, plan, foods, totals, error, update, addFood, savePlan };
}
