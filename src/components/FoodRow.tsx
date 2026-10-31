import type { DayItem } from '../domain/day';
import type { PlanItem } from '../domain/plan';
import type { Nutrients } from '../domain/types';
import { fmt1, formatPortion } from '../ui/format';

type Props = {
  item: DayItem;
  name: string;
  nutrients: Nutrients;
  editedFrom: PlanItem | null;
  isExtra: boolean;
  onToggle: () => void;
  onEdit: () => void;
};

export function FoodRow({ item, name, nutrients: n, editedFrom, isExtra, onToggle, onEdit }: Props) {
  return (
    <li className={`row ${item.checked ? 'row--checked' : ''}`}>
      <label className="row__main">
        <input type="checkbox" checked={item.checked} onChange={onToggle} aria-label={name} />
        <span className="row__text">
          <span className="row__name">{name}</span>
          <span className="row__meta">
            <span>{formatPortion(item)}</span>
            {editedFrom && <span className="chip">edited · plan {formatPortion(editedFrom)}</span>}
            {isExtra && <span className="chip chip--extra">extra</span>}
          </span>
          <span className="row__macros">
            <b>{fmt1(n.kcal)} kcal</b>
            <span className="p">P {fmt1(n.protein)}</span>
            <span className="c">C {fmt1(n.carbs)}</span>
            <span className="f">F {fmt1(n.fat)}</span>
          </span>
          <span className="row__minor">
            Fiber {fmt1(n.fiber)} · Sugar {fmt1(n.sugar)}
          </span>
        </span>
      </label>
      <button type="button" className="icon-btn" aria-label={`Edit ${name}`} onClick={onEdit}>
        ✎
      </button>
    </li>
  );
}
