import { describe, expect, test } from 'vitest';
import type { Food, Nutrients } from './types';
import {
  UnitError,
  ZERO,
  convertibleUnits,
  parseQuantity,
  portionNutrients,
  sumNutrients,
} from './nutrition';

const n = (kcal: number, protein: number, carbs = 0, fat = 0, fiber = 0, sugar = 0): Nutrients => ({
  kcal,
  protein,
  carbs,
  fat,
  fiber,
  sugar,
});

const chicken: Food = {
  id: 'chicken',
  name: 'Chicken Breast, cooked',
  source: 'plan',
  base: { quantity: 150, unit: 'g', nutrients: n(226.5, 43.5, 0, 4.5) },
};
const eggWhites: Food = {
  id: 'egg-whites',
  name: 'Liquid Egg Whites',
  source: 'plan',
  base: { quantity: 100, unit: 'g', nutrients: n(47.6, 11.1) },
};
const whey: Food = {
  id: 'whey',
  name: 'Whey isolate',
  source: 'plan',
  base: { quantity: 1, unit: 'scoop', nutrients: n(106, 24, 1) },
};
const dbEgg: Food = {
  id: 'usda-egg',
  name: 'Egg, whole',
  source: 'usda',
  base: { quantity: 100, unit: 'g', nutrients: n(143, 12.6, 0.7, 9.5) },
  gramsPerUnit: { large: 50 },
};

describe('portionNutrients', () => {
  test('scales grams linearly (chicken 150 g → 200 g)', () => {
    const r = portionNutrients(chicken, { quantity: 200, unit: 'g' });
    expect(r.kcal).toBeCloseTo(302.0, 1);
    expect(r.protein).toBeCloseTo(58.0, 1);
    expect(r.fat).toBeCloseTo(6.0, 1);
  });

  test('scales egg whites 100 g → 150 g', () => {
    const r = portionNutrients(eggWhites, { quantity: 150, unit: 'g' });
    expect(r.kcal).toBeCloseTo(71.4, 1);
    expect(r.protein).toBeCloseTo(16.65, 2);
  });

  test('scales non-gram units in their own unit (2 scoops)', () => {
    const r = portionNutrients(whey, { quantity: 2, unit: 'scoop' });
    expect(r.kcal).toBeCloseTo(212, 5);
    expect(r.protein).toBeCloseTo(48, 5);
  });

  test('converts named units through gramsPerUnit', () => {
    expect(portionNutrients(dbEgg, { quantity: 2, unit: 'large' })).toEqual(
      portionNutrients(dbEgg, { quantity: 100, unit: 'g' }),
    );
  });

  test('throws UnitError when units cannot be converted', () => {
    expect(() => portionNutrients(whey, { quantity: 30, unit: 'g' })).toThrow(UnitError);
  });

  test('zero quantity gives ZERO', () => {
    expect(portionNutrients(chicken, { quantity: 0, unit: 'g' })).toEqual(ZERO);
  });
});

describe('convertibleUnits', () => {
  test('lists base unit, grams when derivable, and named units', () => {
    expect(convertibleUnits(dbEgg)).toEqual(['g', 'large']);
    expect(convertibleUnits(whey)).toEqual(['scoop']);
  });
});

describe('parseQuantity', () => {
  test.each([
    ['1,5', 1.5],
    [' 200 ', 200],
    ['0', 0],
    ['', null],
    ['-1', null],
    ['abc', null],
    ['1.2.3', null],
  ])('%j → %j', (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });
});

describe('sumNutrients', () => {
  test('empty list sums to ZERO', () => {
    expect(sumNutrients([])).toEqual(ZERO);
  });

  test('adds every field', () => {
    expect(sumNutrients([n(1, 2, 3, 4, 5, 6), n(10, 20, 30, 40, 50, 60)])).toEqual(
      n(11, 22, 33, 44, 55, 66),
    );
  });
});
