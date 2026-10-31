export type Nutrients = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
};

export const NUTRIENT_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugar'] as const;

/** A measured amount of food. Unit `'g'` means grams. */
export type Portion = { quantity: number; unit: string };

export type FoodSource = 'plan' | 'off' | 'usda' | 'manual';

/**
 * A food described by one reference portion and its nutrients. Database foods use
 * a 100 g base; plan foods keep the portion they were written with (e.g. 1 scoop).
 */
export type Food = {
  id: string;
  name: string;
  source: FoodSource;
  base: Portion & { nutrients: Nutrients };
  gramsPerUnit?: Record<string, number>;
};
