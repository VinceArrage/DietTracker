import type { Goals } from '../domain/plan';
import type { Nutrients } from '../domain/types';
import { fmtInt } from '../ui/format';

// The transcribed plan totals 3246.4 kcal against a 3247 goal; ignore rounding-sized gaps.
const KCAL_SLACK = 5;
const GRAM_SLACK = 1;

/** Says whether everything still planned for today (skips and edits included) reaches the goals. */
export function PlanCheck({ planned, goals }: { planned: Nutrients; goals: Goals }) {
  const gaps = [
    { label: 'kcal', short: goals.kcal - planned.kcal, slack: KCAL_SLACK, fmt: (n: number) => `${fmtInt(n)} kcal` },
    { label: 'P', short: goals.protein - planned.protein, slack: GRAM_SLACK, fmt: (n: number) => `P ${fmtInt(n)} g` },
    { label: 'C', short: goals.carbs - planned.carbs, slack: GRAM_SLACK, fmt: (n: number) => `C ${fmtInt(n)} g` },
    { label: 'F', short: goals.fat - planned.fat, slack: GRAM_SLACK, fmt: (n: number) => `F ${fmtInt(n)} g` },
  ].filter((g) => g.short > g.slack);

  return (
    <p role="status" aria-label="Plan check" className={`plan-check ${gaps.length ? 'plan-check--short' : ''}`}>
      {gaps.length === 0
        ? 'Your plan for today covers your goals'
        : `Today’s plan is short: ${gaps.map((g) => g.fmt(g.short)).join(' · ')} — add extras to make it up`}
    </p>
  );
}
