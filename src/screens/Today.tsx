import { useState } from 'react';
import { setSkipped, toggleItem } from '../domain/day';
import { FoodSheet, type SheetMode } from '../components/FoodSheet';
import { MealCard } from '../components/MealCard';
import { TotalsPanel } from '../components/TotalsPanel';
import { useToday } from '../state/useToday';
import { formatDayLabel } from '../ui/format';

export default function Today() {
  const today = useToday();
  const { day, plan, foods, totals, error, update } = today;
  const [sheet, setSheet] = useState<SheetMode | null>(null);

  return (
    <>
      <header className="today-head">
        <h1>Today</h1>
        {day && <span className="muted">{formatDayLabel(day.date)}</span>}
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {day && plan
        ? day.meals.map((meal) => (
            <MealCard
              key={meal.planMealId}
              meal={meal}
              plan={plan}
              foods={foods}
              onToggle={(id) => update((d) => toggleItem(d, id))}
              onEdit={(itemId) => setSheet({ kind: 'edit', itemId })}
              onAdd={() => setSheet({ kind: 'add', mealId: meal.planMealId })}
              onSkip={(skipped) => update((d) => setSkipped(d, meal.planMealId, skipped))}
            />
          ))
        : !error && <p className="muted">Loading…</p>}
      {day && totals && <TotalsPanel totals={totals} goals={day.goals} />}
      {sheet && <FoodSheet key={JSON.stringify(sheet)} mode={sheet} today={today} onClose={() => setSheet(null)} />}
    </>
  );
}
