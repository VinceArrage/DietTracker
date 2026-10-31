import { useState } from 'react';
import { setSkipped, toggleItem } from '../domain/day';
import { FoodSheet, type SheetMode } from '../components/FoodSheet';
import { MacroBar } from '../components/MacroBar';
import { MealCard } from '../components/MealCard';
import { useToday } from '../state/useToday';
import { formatDayLabel } from '../ui/format';

export default function Today() {
  const today = useToday();
  const { day, plan, foods, totals, error, update } = today;
  const [sheet, setSheet] = useState<SheetMode | null>(null);

  return (
    <>
      <header className="today-head">
        <div className="today-head__title">
          <h1>Today</h1>
          {day && <span className="muted">{formatDayLabel(day.date)}</span>}
        </div>
        {day && totals && (
          <div className="macros">
            <MacroBar label="Calories" eaten={totals.eaten.kcal} goal={day.goals.kcal} color="var(--accent)" />
            <MacroBar label="Protein" eaten={totals.eaten.protein} goal={day.goals.protein} unit=" g" color="var(--prot)" />
            <MacroBar label="Carbs" eaten={totals.eaten.carbs} goal={day.goals.carbs} unit=" g" color="var(--carb)" />
            <MacroBar label="Fat" eaten={totals.eaten.fat} goal={day.goals.fat} unit=" g" color="var(--fat)" />
          </div>
        )}
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
      {sheet && <FoodSheet key={JSON.stringify(sheet)} mode={sheet} today={today} onClose={() => setSheet(null)} />}
    </>
  );
}
