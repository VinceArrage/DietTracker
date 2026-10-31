import { useState } from 'react';
import type { DayTotals } from '../domain/day';
import type { Goals } from '../domain/plan';
import { fmtInt } from '../ui/format';
import { MacroBar } from './MacroBar';
import { PlanCheck } from './PlanCheck';

const STORAGE_KEY = 'diettracker.totalsOpen';

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function writeOpen(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(open));
  } catch {
    // Private mode or blocked storage: the panel just won't remember its state.
  }
}

/** Daily totals pinned above the tab bar; collapses to a one-line summary. */
export function TotalsPanel({ totals, goals }: { totals: DayTotals; goals: Goals }) {
  const [open, setOpen] = useState(readOpen);
  const { eaten } = totals;
  const kcalMet = Math.round(eaten.kcal) >= Math.round(goals.kcal);

  return (
    <aside className={`totals ${open ? 'totals--open' : ''}`} aria-label="Daily totals panel">
      <button
        type="button"
        className="totals__toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          writeOpen(!open);
        }}
      >
        <span className={open ? 'totals__title' : 'sr-only'}>Daily totals</span>
        {!open && (
          <span className="totals__compact">
            <b className={kcalMet ? 'ok' : undefined}>
              {fmtInt(eaten.kcal)} / {fmtInt(goals.kcal)} kcal
            </b>
            <span className="p">
              P {fmtInt(eaten.protein)}/{fmtInt(goals.protein)}
            </span>
            <span className="c">
              C {fmtInt(eaten.carbs)}/{fmtInt(goals.carbs)}
            </span>
            <span className="f">
              F {fmtInt(eaten.fat)}/{fmtInt(goals.fat)}
            </span>
          </span>
        )}
        <span className="totals__chevron" aria-hidden="true">
          {open ? '▾' : '▴'}
        </span>
      </button>
      {open && (
        <div className="totals__body">
          <div className="macros">
            <MacroBar label="Calories" eaten={eaten.kcal} goal={goals.kcal} color="var(--accent)" />
            <MacroBar label="Protein" eaten={eaten.protein} goal={goals.protein} unit=" g" color="var(--prot)" />
            <MacroBar label="Carbs" eaten={eaten.carbs} goal={goals.carbs} unit=" g" color="var(--carb)" />
            <MacroBar label="Fat" eaten={eaten.fat} goal={goals.fat} unit=" g" color="var(--fat)" />
          </div>
          <PlanCheck planned={totals.planned} goals={goals} />
        </div>
      )}
    </aside>
  );
}
