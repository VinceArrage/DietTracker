import { fmtInt } from '../ui/format';

type Props = { label: string; eaten: number; goal: number; unit?: string; color: string };

export function MacroBar({ label, eaten, goal, unit = '', color }: Props) {
  const pct = goal > 0 ? Math.min(100, (eaten / goal) * 100) : 0;
  const diff = Math.round(eaten) - Math.round(goal);
  const status = diff < 0 ? `${fmtInt(-diff)}${unit} to go` : diff > 0 ? `+${fmtInt(diff)}${unit} over` : 'Goal met';
  return (
    <div role="group" aria-label={label} className={`macro ${diff >= 0 ? 'macro--met' : ''}`}>
      <div className="macro__top">
        <span className="macro__label">{label}</span>
        <span className="macro__value">
          {fmtInt(eaten)} / {fmtInt(goal)}
        </span>
      </div>
      <div className="macro__track">
        <div className="macro__fill" style={{ width: `${pct}%`, background: diff >= 0 ? 'var(--ok)' : color }} />
      </div>
      <span className="macro__status">{status}</span>
    </div>
  );
}
