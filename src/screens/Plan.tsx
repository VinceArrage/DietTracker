import { useEffect, useState } from 'react';
import { FoodSearch, ManualFood, PortionPicker, Sheet } from '../components/FoodSheet';
import { parseQuantity } from '../domain/nutrition';
import { planItemNutrients, type Meal, type Plan } from '../domain/plan';
import type { Food, Portion } from '../domain/types';
import { getOrCreateDay, loadPlan, localDateKey, saveDay, saveFood, savePlan } from '../storage/repo';
import { fmt1, formatPortion } from '../ui/format';

type GoalKey = 'kcal' | 'protein' | 'carbs' | 'fat';
const GOAL_FIELDS: { key: GoalKey; label: string }[] = [
  { key: 'kcal', label: 'Calories' },
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbs' },
  { key: 'fat', label: 'Fat' },
];

type PlanSheet = { kind: 'edit'; mealId: string; itemId: string } | { kind: 'add'; mealId: string };

export default function PlanScreen() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [foods, setFoods] = useState<Map<string, Food>>(new Map());
  const [goalText, setGoalText] = useState<Record<GoalKey, string>>({ kcal: '', protein: '', carbs: '', fat: '' });
  const [message, setMessage] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PlanSheet | null>(null);

  useEffect(() => {
    let alive = true;
    void loadPlan().then(({ plan: p, foods: f }) => {
      if (!alive) return;
      setPlan(p);
      setFoods(new Map(f.map((x) => [x.id, x])));
      setGoalText({ kcal: String(p.goals.kcal), protein: String(p.goals.protein), carbs: String(p.goals.carbs), fat: String(p.goals.fat) });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!plan) return <p className="muted">Loading…</p>;

  const persist = (next: Plan) => {
    setPlan(next);
    savePlan(next).catch((e: unknown) => {
      console.error('Failed to save plan', e);
      setMessage('Could not save your plan.');
    });
  };

  const mapMeal = (mealId: string, fn: (m: Meal) => Meal) =>
    persist({ ...plan, meals: plan.meals.map((m) => (m.id === mealId ? fn(m) : m)) });

  const goalValues = GOAL_FIELDS.map(({ key }) => parseQuantity(goalText[key]));
  const goalsValid = goalValues.every((v) => v !== null && v > 0);

  const saveGoals = async () => {
    if (!goalsValid) return;
    const goals = { ...plan.goals };
    GOAL_FIELDS.forEach(({ key }, i) => (goals[key] = goalValues[i]!));
    const next = { ...plan, goals };
    setPlan(next);
    await savePlan(next);
    // Goals apply to today as well; earlier days keep the goals they were tracked against.
    const today = await getOrCreateDay(localDateKey(new Date()));
    await saveDay({ ...today, goals });
    setMessage('Goals saved');
  };

  const addFoodIfNew = async (food: Food) => {
    if (foods.has(food.id)) return;
    await saveFood(food);
    setFoods((prev) => new Map(prev).set(food.id, food));
  };

  return (
    <>
      <h1>Plan</h1>
      <p className="muted">Changes to foods and meals apply from your next new day. Today keeps its own list.</p>

      <form
        className="card goals"
        onSubmit={(e) => {
          e.preventDefault();
          void saveGoals();
        }}
      >
        <h2>Daily goals</h2>
        <div className="goals__grid">
          {GOAL_FIELDS.map(({ key, label }) => (
            <label key={key} className="manual__field">
              {label} {key === 'kcal' ? '(kcal)' : '(g)'}
              <input
                aria-label={`${label} goal`}
                inputMode="decimal"
                value={goalText[key]}
                onChange={(e) => {
                  setMessage(null);
                  setGoalText({ ...goalText, [key]: e.target.value });
                }}
              />
            </label>
          ))}
        </div>
        <button type="submit" className="btn btn--primary" disabled={!goalsValid}>
          Save goals
        </button>
        {message && (
          <p role="status" className="muted">
            {message}
          </p>
        )}
      </form>

      {plan.meals.map((meal, mi) => (
        <section key={meal.id} aria-label={`Plan meal ${mi + 1}`} className="meal">
          <header className="meal__head">
            <input
              className="meal__name-input"
              aria-label="Meal name"
              value={meal.name}
              onChange={(e) => setPlan({ ...plan, meals: plan.meals.map((m) => (m.id === meal.id ? { ...m, name: e.target.value } : m)) })}
              onBlur={() => persist(plan)}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${meal.name}`}
              onClick={() => {
                if (window.confirm(`Remove "${meal.name}" from your plan?`)) {
                  persist({ ...plan, meals: plan.meals.filter((m) => m.id !== meal.id) });
                }
              }}
            >
              🗑
            </button>
          </header>
          <ul className="rows">
            {meal.items.map((item) => {
              const food = foods.get(item.foodId);
              const name = food?.name ?? 'Unknown food';
              const kcal = food ? planItemNutrients(item, foods).kcal : 0;
              return (
                <li key={item.id} className="row">
                  <div className="row__main">
                    <span className="row__text">
                      <span className="row__name">{name}</span>
                      <span className="row__meta">
                        <span>{formatPortion(item)}</span>
                        <span>{fmt1(kcal)} kcal</span>
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Edit ${name}`}
                    onClick={() => setSheet({ kind: 'edit', mealId: meal.id, itemId: item.id })}
                  >
                    ✎
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className="add-btn" onClick={() => setSheet({ kind: 'add', mealId: meal.id })}>
            + Add food
          </button>
        </section>
      ))}

      <button
        type="button"
        className="btn add-meal"
        onClick={() =>
          persist({
            ...plan,
            meals: [...plan.meals, { id: `meal-${crypto.randomUUID()}`, name: `Meal ${plan.meals.length + 1}`, note: null, items: [] }],
          })
        }
      >
        + Add meal
      </button>

      {sheet && (
        <PlanItemSheet
          sheet={sheet}
          plan={plan}
          foods={foods}
          onClose={() => setSheet(null)}
          onSaveItem={(portion) => {
            if (sheet.kind !== 'edit') return;
            mapMeal(sheet.mealId, (m) => ({
              ...m,
              items: m.items.map((i) => (i.id === sheet.itemId ? { ...i, ...portion } : i)),
            }));
          }}
          onRemoveItem={() => {
            if (sheet.kind !== 'edit') return;
            mapMeal(sheet.mealId, (m) => ({ ...m, items: m.items.filter((i) => i.id !== sheet.itemId) }));
          }}
          onAddItem={async (food, portion) => {
            await addFoodIfNew(food);
            mapMeal(sheet.mealId, (m) => ({
              ...m,
              items: [...m.items, { id: `${m.id}-item-${crypto.randomUUID()}`, foodId: food.id, ...portion }],
            }));
          }}
        />
      )}
    </>
  );
}

type SheetProps = {
  sheet: PlanSheet;
  plan: Plan;
  foods: Map<string, Food>;
  onClose: () => void;
  onSaveItem: (portion: Portion) => void;
  onRemoveItem: () => void;
  onAddItem: (food: Food, portion: Portion) => Promise<void>;
};

function PlanItemSheet({ sheet, plan, foods, onClose, onSaveItem, onRemoveItem, onAddItem }: SheetProps) {
  const [picked, setPicked] = useState<Food | null>(null);
  const [manual, setManual] = useState(false);

  if (sheet.kind === 'edit') {
    const item = plan.meals.find((m) => m.id === sheet.mealId)?.items.find((i) => i.id === sheet.itemId);
    const food = item && foods.get(item.foodId);
    if (!item || !food) return null;
    return (
      <Sheet title={food.name} onClose={onClose}>
        <PortionPicker
          food={food}
          initial={item}
          confirmLabel="Save"
          allowPlanUpdate={false}
          onConfirm={(portion) => {
            onSaveItem(portion);
            onClose();
          }}
        />
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              onRemoveItem();
              onClose();
            }}
          >
            Remove from plan
          </button>
        </div>
      </Sheet>
    );
  }

  if (picked) {
    return (
      <Sheet title={picked.name} onClose={onClose}>
        <PortionPicker
          food={picked}
          initial={picked.base.unit === 'g' ? { quantity: 100, unit: 'g' } : { quantity: 1, unit: picked.base.unit }}
          confirmLabel="Add to plan"
          allowPlanUpdate={false}
          onConfirm={(portion) => void onAddItem(picked, portion).then(onClose)}
        />
      </Sheet>
    );
  }

  return (
    <Sheet title="Add food to plan" onClose={onClose}>
      {manual ? <ManualFood onCreate={setPicked} /> : <FoodSearch foods={foods} onPick={setPicked} onManual={() => setManual(true)} />}
    </Sheet>
  );
}
