import { useState } from 'react';
import { editedFrom, hasPlanItem, itemNutrients, type DayMeal } from '../domain/day';
import { sumNutrients } from '../domain/nutrition';
import type { Plan } from '../domain/plan';
import type { Food } from '../domain/types';
import { fmtInt } from '../ui/format';
import { FoodRow } from './FoodRow';

type Props = {
  meal: DayMeal;
  plan: Plan;
  foods: Map<string, Food>;
  onToggle: (itemId: string) => void;
  onEdit: (itemId: string) => void;
  onAdd: () => void;
  onSkip: (skipped: boolean) => void;
};

export function MealCard({ meal, plan, foods, onToggle, onEdit, onAdd, onSkip }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rows = meal.items.map((item) => ({ item, n: itemNutrients(item, foods) }));
  const planned = sumNutrients(rows.map((r) => r.n));
  const eaten = sumNutrients(rows.filter((r) => r.item.checked).map((r) => r.n));

  return (
    <section aria-label={meal.name} className={`meal ${meal.skipped ? 'meal--skipped' : ''}`}>
      <header className="meal__head">
        <h2>{meal.name}</h2>
        {meal.skipped ? (
          <span className="chip">Skipped</span>
        ) : (
          <span className="meal__kcal">
            {fmtInt(eaten.kcal)} / {fmtInt(planned.kcal)} kcal
          </span>
        )}
        <div className="menu">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Options for ${meal.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋮
          </button>
          {menuOpen && (
            <div role="menu" className="menu__list">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSkip(!meal.skipped);
                }}
              >
                {meal.skipped ? 'Unskip meal' : 'Skip meal'}
              </button>
            </div>
          )}
        </div>
      </header>
      {!meal.skipped && (
        <>
          {meal.note && <p className="meal__note">{meal.note}</p>}
          <ul className="rows">
            {rows.map(({ item, n }) => (
              <FoodRow
                key={item.id}
                item={item}
                name={foods.get(item.foodId)?.name ?? 'Unknown food'}
                nutrients={n}
                editedFrom={editedFrom(item, plan)}
                isExtra={!hasPlanItem(item, plan)}
                onToggle={() => onToggle(item.id)}
                onEdit={() => onEdit(item.id)}
              />
            ))}
          </ul>
          <button type="button" className="add-btn" onClick={onAdd}>
            + Add extra
          </button>
        </>
      )}
    </section>
  );
}
