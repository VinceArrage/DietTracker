import { useEffect, useId, useMemo, useState } from 'react';
import { addExtra, applyItemToPlan, hasPlanItem, removeItem, replaceFood, setPortion, type DayItem } from '../domain/day';
import { ZERO, convertibleUnits, parseQuantity, portionNutrients } from '../domain/nutrition';
import { slugify } from '../domain/plan';
import type { Food, Nutrients, Portion } from '../domain/types';
import { searchFoods, type SearchError } from '../lookup/search';
import type { TodayState } from '../state/useToday';
import { loadSettings } from '../storage/repo';
import { fmt1, formatPortion } from '../ui/format';

export type SheetMode = { kind: 'edit'; itemId: string } | { kind: 'add'; mealId: string } | { kind: 'swap'; itemId: string };

type Props = { mode: SheetMode; today: TodayState; onClose: () => void };

const SOURCE_LABEL: Record<Food['source'], string> = {
  plan: 'Your foods',
  manual: 'Your foods',
  off: 'Open Food Facts',
  usda: 'USDA',
};

function findItem(today: TodayState, itemId: string): DayItem | undefined {
  return today.day?.meals.flatMap((m) => m.items).find((i) => i.id === itemId);
}

function safeNutrients(food: Food, portion: Portion | null): Nutrients {
  if (!portion) return ZERO;
  try {
    return portionNutrients(food, portion);
  } catch {
    return ZERO;
  }
}

export function FoodSheet({ mode, today, onClose }: Props) {
  const [step, setStep] = useState<'main' | 'search' | 'manual' | 'portion'>(mode.kind === 'edit' ? 'main' : 'search');
  const [picked, setPicked] = useState<Food | null>(null);
  const [saveError, setSaveError] = useState(false);
  const swapTarget = mode.kind === 'add' ? null : mode.itemId;
  const editItem = mode.kind === 'edit' ? findItem(today, mode.itemId) : undefined;
  const editFood = editItem ? today.foods.get(editItem.foodId) : undefined;
  const confirmLabel = mode.kind === 'add' ? 'Add' : 'Replace';

  const choose = (food: Food) => {
    setPicked(food);
    setStep('portion');
  };

  const commitPicked = async (portion: Portion) => {
    if (!picked) return;
    try {
      if (!today.foods.has(picked.id)) await today.addFood(picked);
    } catch (e) {
      console.error(`Failed to save food ${picked.id}`, e);
      setSaveError(true);
      return;
    }
    if (mode.kind === 'add') today.update((d) => addExtra(d, mode.mealId, picked.id, portion));
    else if (swapTarget) today.update((d) => replaceFood(d, swapTarget, picked.id, portion));
    onClose();
  };

  let title = 'Add food';
  let body: React.ReactNode = null;
  if (step === 'main' && editItem && editFood) {
    title = editFood.name;
    body = (
      <>
        <PortionPicker
          food={editFood}
          initial={editItem}
          confirmLabel="Save"
          allowPlanUpdate={today.plan !== null && hasPlanItem(editItem, today.plan)}
          onConfirm={(portion, alsoPlan) => {
            today.update((d) => {
              const next = setPortion(d, editItem.id, portion);
              if (alsoPlan && today.plan) void today.savePlan(applyItemToPlan(today.plan, next, editItem.id));
              return next;
            });
            onClose();
          }}
        />
        <div className="sheet__actions">
          <button type="button" className="btn" onClick={() => setStep('search')}>
            Swap food
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              today.update((d) => removeItem(d, editItem.id));
              onClose();
            }}
          >
            Remove
          </button>
        </div>
      </>
    );
  } else if (step === 'search') {
    title = mode.kind === 'add' ? 'Add food' : 'Swap food';
    body = <FoodSearch foods={today.foods} onPick={choose} onManual={() => setStep('manual')} />;
  } else if (step === 'manual') {
    title = 'Enter food';
    body = <ManualFood onCreate={choose} />;
  } else if (step === 'portion' && picked) {
    title = picked.name;
    body = (
      <PortionPicker
        food={picked}
        initial={picked.base.unit === 'g' ? { quantity: 100, unit: 'g' } : { quantity: 1, unit: picked.base.unit }}
        confirmLabel={confirmLabel}
        allowPlanUpdate={false}
        onConfirm={(portion) => void commitPicked(portion)}
      />
    );
  }

  return (
    <Sheet title={title} onClose={onClose}>
      {saveError && (
        <p role="alert" className="error">
          Could not save this food. Please try again.
        </p>
      )}
      {body}
    </Sheet>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export type PickerProps = {
  food: Food;
  initial: Portion;
  confirmLabel: string;
  allowPlanUpdate: boolean;
  onConfirm: (portion: Portion, alsoPlan: boolean) => void;
};

export function PortionPicker({ food, initial, confirmLabel, allowPlanUpdate, onConfirm }: PickerProps) {
  const id = useId();
  const [text, setText] = useState(String(initial.quantity));
  const [unit, setUnit] = useState(initial.unit);
  const [alsoPlan, setAlsoPlan] = useState(false);
  const units = useMemo(() => {
    const list = convertibleUnits(food);
    return list.includes(initial.unit) ? list : [initial.unit, ...list];
  }, [food, initial.unit]);
  const quantity = parseQuantity(text);
  const portion = quantity === null ? null : { quantity, unit };
  const n = safeNutrients(food, portion);

  return (
    <form
      className="picker"
      onSubmit={(e) => {
        e.preventDefault();
        if (portion) onConfirm(portion, alsoPlan);
      }}
    >
      <div className="picker__inputs">
        <label htmlFor={`${id}-qty`}>Amount</label>
        <input
          id={`${id}-qty`}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <p className="picker__preview">
        <b>{fmt1(n.kcal)} kcal</b>
        <span className="p">P {fmt1(n.protein)}</span>
        <span className="c">C {fmt1(n.carbs)}</span>
        <span className="f">F {fmt1(n.fat)}</span>
      </p>
      {allowPlanUpdate && (
        <label className="picker__check">
          <input type="checkbox" checked={alsoPlan} onChange={(e) => setAlsoPlan(e.target.checked)} />
          Also update my plan
        </label>
      )}
      <button type="submit" className="btn btn--primary" disabled={!portion}>
        {confirmLabel}
      </button>
    </form>
  );
}

const normalize = (s: string) => slugify(s).replace(/-/g, ' ');

export function FoodSearch({ foods, onPick, onManual }: { foods: Map<string, Food>; onPick: (f: Food) => void; onManual: () => void }) {
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<Food[]>([]);
  const [errors, setErrors] = useState<SearchError[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'offline'>('idle');

  const local = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    return [...foods.values()].filter((f) => normalize(f.name).includes(q));
  }, [foods, query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus('loading');
      try {
        const settings = await loadSettings();
        const r = await searchFoods(q, { usdaKey: settings.usdaKey, signal: ctrl.signal });
        const allFailed = r.results.length === 0 && r.errors.length >= 2;
        setRemote(r.results);
        setErrors(allFailed ? [] : r.errors);
        setStatus(allFailed ? 'offline' : 'idle');
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.warn(`Food search failed for "${q}"`, e);
        setRemote([]);
        setErrors([]);
        setStatus('offline');
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const localIds = new Set(local.map((f) => f.id));
  const results = [...local, ...remote.filter((f) => !localIds.has(f.id))];

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Search foods (e.g. banana, St-Méthode)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length < 2) {
            setRemote([]);
            setErrors([]);
            setStatus('idle');
          }
        }}
        autoFocus
      />
      <div role="status" className="search__status">
        {status === 'loading' && <span className="muted">Searching…</span>}
        {status === 'offline' && <span>Search is offline — showing your foods only</span>}
        {errors.map((e) => (
          <span key={e.source}>{e.message}</span>
        ))}
      </div>
      <ul className="results">
        {results.map((f) => (
          <li key={f.id}>
            <button type="button" className="result" onClick={() => onPick(f)}>
              <span className="result__name">{f.name}</span>
              <span className="muted">
                {SOURCE_LABEL[f.source]} · {fmt1(f.base.nutrients.kcal)} kcal per {formatPortion(f.base)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={onManual}>
        No match? Enter manually
      </button>
    </div>
  );
}

export function ManualFood({ onCreate }: { onCreate: (f: Food) => void }) {
  const [name, setName] = useState('');
  const [values, setValues] = useState({ grams: '100', kcal: '', protein: '', carbs: '', fat: '' });
  const parsed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseQuantity(v)])) as Record<
    keyof typeof values,
    number | null
  >;
  const valid = name.trim() !== '' && parsed.grams !== null && parsed.grams > 0 && parsed.kcal !== null;
  const field = (key: keyof typeof values, label: string) => (
    <label className="manual__field">
      {label}
      <input inputMode="decimal" value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
    </label>
  );

  return (
    <form
      className="manual"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onCreate({
          id: `manual-${crypto.randomUUID()}`,
          name: name.trim(),
          source: 'manual',
          base: {
            quantity: parsed.grams!,
            unit: 'g',
            nutrients: {
              kcal: parsed.kcal!,
              protein: parsed.protein ?? 0,
              carbs: parsed.carbs ?? 0,
              fat: parsed.fat ?? 0,
              fiber: 0,
              sugar: 0,
            },
          },
        });
      }}
    >
      <label className="manual__field manual__field--wide">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {field('grams', 'Per grams')}
      {field('kcal', 'kcal')}
      {field('protein', 'Protein g')}
      {field('carbs', 'Carbs g')}
      {field('fat', 'Fat g')}
      <button type="submit" className="btn btn--primary" disabled={!valid}>
        Continue
      </button>
    </form>
  );
}
