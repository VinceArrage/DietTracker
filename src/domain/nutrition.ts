import { NUTRIENT_KEYS, type Food, type Nutrients, type Portion } from './types';

export const ZERO: Nutrients = Object.freeze({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 });

export class UnitError extends Error {
  constructor(food: Food, unit: string) {
    super(`Cannot convert "${unit}" for ${food.name} (base unit "${food.base.unit}")`);
    this.name = 'UnitError';
  }
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out = { ...ZERO };
  for (const k of NUTRIENT_KEYS) out[k] = n[k] * factor;
  return out;
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const out = { ...ZERO };
  for (const k of NUTRIENT_KEYS) out[k] = a[k] + b[k];
  return out;
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(addNutrients, { ...ZERO });
}

/** Grams in one `unit` of this food, or null when unknown. */
function gramsPer(food: Food, unit: string): number | null {
  if (unit === 'g') return 1;
  return food.gramsPerUnit?.[unit] ?? null;
}

export function portionNutrients(food: Food, portion: Portion): Nutrients {
  if (portion.quantity === 0) return { ...ZERO };
  const { base } = food;
  if (portion.unit === base.unit) {
    return scaleNutrients(base.nutrients, portion.quantity / base.quantity);
  }
  const portionG = gramsPer(food, portion.unit);
  const baseG = gramsPer(food, base.unit);
  if (portionG === null || baseG === null) throw new UnitError(food, portion.unit);
  return scaleNutrients(base.nutrients, (portion.quantity * portionG) / (base.quantity * baseG));
}

export function convertibleUnits(food: Food): string[] {
  const units = [food.base.unit];
  const named = Object.keys(food.gramsPerUnit ?? {});
  const gramsDerivable = food.base.unit === 'g' || food.gramsPerUnit?.[food.base.unit] !== undefined;
  if (gramsDerivable && !units.includes('g')) units.push('g');
  if (gramsDerivable) for (const u of named) if (!units.includes(u)) units.push(u);
  return units;
}

/** Parses a user-typed amount; accepts a comma decimal. Empty, negative or junk → null. */
export function parseQuantity(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  return Number(t);
}
