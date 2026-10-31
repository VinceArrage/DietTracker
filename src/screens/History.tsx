import { useCallback, useEffect, useState } from 'react';
import { dayTotals, itemNutrients, type DayLog } from '../domain/day';
import type { Food } from '../domain/types';
import { getOrCreateDay, listDays, loadFoods } from '../storage/repo';
import { fmt1, fmtInt, formatDayLabel, formatPortion } from '../ui/format';

/** Runs an async load; a failure is logged and reported instead of leaving "Loading…" up. */
function useLoad<T>(load: () => Promise<T>, what: string): { data: T | null; failed: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setData(d))
      .catch((e: unknown) => {
        console.error(`Failed to load ${what}`, e);
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [load, what]);
  return { data, failed };
}

const LoadError = () => (
  <p role="alert" className="error">
    Could not load your history.
  </p>
);

const goalsMet = (day: DayLog, foods: Map<string, Food>) => {
  const { remaining } = dayTotals(day, foods);
  return remaining.kcal < 0.5 && remaining.protein < 0.5 && remaining.carbs < 0.5 && remaining.fat < 0.5;
};

export function History() {
  const { data: foods, failed: foodsFailed } = useLoad(loadFoods, 'foods');
  const { data: days, failed: daysFailed } = useLoad(listDays, 'days');

  return (
    <>
      <h1>History</h1>
      {foodsFailed || daysFailed ? (
        <LoadError />
      ) : !days || !foods ? (
        <p className="muted">Loading…</p>
      ) : days.length === 0 ? (
        <p className="muted">No days tracked yet.</p>
      ) : (
        <ul className="history">
          {days.map((day) => {
            const { eaten } = dayTotals(day, foods);
            const met = goalsMet(day, foods);
            return (
              <li key={day.date}>
                <a className="history__row" href={`#/history/${day.date}`}>
                  <span className="history__date">
                    {formatDayLabel(day.date)} {met && <span className="ok" aria-label="all goals met">✓</span>}
                  </span>
                  <span className="muted">
                    {fmtInt(eaten.kcal)} / {fmtInt(day.goals.kcal)} kcal · P {fmtInt(eaten.protein)} / {fmtInt(day.goals.protein)} g
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function DayView({ date }: { date: string }) {
  const { data: foods, failed: foodsFailed } = useLoad(loadFoods, 'foods');
  const loadDay = useCallback(() => getOrCreateDay(date), [date]);
  const { data: day, failed: dayFailed } = useLoad(loadDay, `day ${date}`);

  if (foodsFailed || dayFailed) return <LoadError />;
  if (!day || !foods) return <p className="muted">Loading…</p>;
  const { eaten } = dayTotals(day, foods);

  return (
    <>
      <a href="#/history" className="back">
        ‹ History
      </a>
      <h1>{formatDayLabel(day.date)}</h1>
      <p className="muted">
        {fmtInt(eaten.kcal)} / {fmtInt(day.goals.kcal)} kcal · P {fmtInt(eaten.protein)} · C {fmtInt(eaten.carbs)} · F {fmtInt(eaten.fat)}
      </p>
      {day.meals.map((meal) => (
        <section key={meal.planMealId} aria-label={meal.name} className="meal">
          <header className="meal__head">
            <h2>{meal.name}</h2>
            {meal.skipped && <span className="chip">Skipped</span>}
          </header>
          {!meal.skipped && (
            <ul className="rows">
              {meal.items.map((item) => (
                <li key={item.id} className={`row row--readonly ${item.checked ? 'row--checked' : 'row--missed'}`}>
                  <span aria-label={item.checked ? 'eaten' : 'not eaten'} className="row__mark">
                    {item.checked ? '✓' : '–'}
                  </span>
                  <span className="row__text">
                    <span className="row__name">{foods.get(item.foodId)?.name ?? 'Unknown food'}</span>
                    <span className="row__meta">
                      <span>{formatPortion(item)}</span>
                      <span>{fmt1(itemNutrients(item, foods).kcal)} kcal</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
