import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';
import { beforeEach, expect, test, vi } from 'vitest';
import type { Food } from '../domain/types';
import { searchFoods } from '../lookup/search';
import Today from '../screens/Today';
import { loadPlan } from '../storage/repo';

vi.mock('../lookup/search', () => ({ searchFoods: vi.fn() }));

const banana: Food = {
  id: 'usda-173944',
  name: 'Bananas, raw',
  source: 'usda',
  base: { quantity: 100, unit: 'g', nutrients: { kcal: 89, protein: 1.09, carbs: 22.8, fat: 0.33, fiber: 2.6, sugar: 12.2 } },
};

beforeEach(async () => {
  await clear();
  vi.mocked(searchFoods).mockReset();
});

const meal = (name: string) => screen.getByRole('region', { name });
const sheet = () => screen.getByRole('dialog');
const kcalBar = () => screen.getByRole('group', { name: 'Calories' });

async function openEdit(user: ReturnType<typeof userEvent.setup>, mealName: string, food: string) {
  await screen.findByRole('region', { name: mealName });
  await user.click(within(meal(mealName)).getByRole('button', { name: `Edit ${food}` }));
  return within(sheet());
}

test('editing chicken to 200 g previews 302 kcal and updates the row for today', async () => {
  const user = userEvent.setup();
  render(<Today />);
  const s = await openEdit(user, 'Meal 3', 'Chicken Breast, cooked');
  const qty = s.getByLabelText('Amount');
  await user.clear(qty);
  await user.type(qty, '200');
  expect(s.getByText('302 kcal')).toBeInTheDocument();
  await user.click(s.getByRole('button', { name: 'Save' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(within(meal('Meal 3')).getByText('200 g')).toBeInTheDocument();
  expect((await loadPlan()).plan.meals[2]!.items[0]!.quantity).toBe(150);
});

test('"Also update my plan" saves the new amount into the plan', async () => {
  const user = userEvent.setup();
  render(<Today />);
  const s = await openEdit(user, 'Meal 3', 'Chicken Breast, cooked');
  await user.clear(s.getByLabelText('Amount'));
  await user.type(s.getByLabelText('Amount'), '200');
  await user.click(s.getByRole('checkbox', { name: 'Also update my plan' }));
  await user.click(s.getByRole('button', { name: 'Save' }));
  await vi.waitFor(async () => expect((await loadPlan()).plan.meals[2]!.items[0]!.quantity).toBe(200));
});

test('a comma decimal works: 1,5 scoops of whey = 159 kcal', async () => {
  const user = userEvent.setup();
  render(<Today />);
  const s = await openEdit(user, 'Meal 1 (pré-workout)', 'Whey isolate');
  await user.clear(s.getByLabelText('Amount'));
  await user.type(s.getByLabelText('Amount'), '1,5');
  expect(s.getByText('159 kcal')).toBeInTheDocument();
});

test('an empty amount disables Save and never shows NaN', async () => {
  const user = userEvent.setup();
  render(<Today />);
  const s = await openEdit(user, 'Meal 1 (pré-workout)', 'Whey isolate');
  await user.clear(s.getByLabelText('Amount'));
  expect(s.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(s.getByText('0 kcal')).toBeInTheDocument();
  expect(sheet().textContent).not.toMatch(/NaN/);
});

test('removing a food takes it off today only', async () => {
  const user = userEvent.setup();
  render(<Today />);
  const s = await openEdit(user, 'Meal 1 (pré-workout)', 'Whey isolate');
  await user.click(s.getByRole('button', { name: 'Remove' }));
  expect(within(meal('Meal 1 (pré-workout)')).getAllByRole('checkbox')).toHaveLength(7);
});

test('adding an extra banana from search counts it as eaten', async () => {
  vi.mocked(searchFoods).mockResolvedValue({ results: [banana], errors: [] });
  const user = userEvent.setup();
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 2 (post-workout)' });
  await user.click(within(meal('Meal 2 (post-workout)')).getByRole('button', { name: '+ Add extra' }));
  await user.type(within(sheet()).getByRole('searchbox'), 'banana');
  await user.click(await within(sheet()).findByRole('button', { name: /Bananas, raw/ }));
  const qty = within(sheet()).getByLabelText('Amount');
  await user.clear(qty);
  await user.type(qty, '120');
  await user.click(within(sheet()).getByRole('button', { name: 'Add' }));
  expect(await within(meal('Meal 2 (post-workout)')).findByRole('checkbox', { name: 'Bananas, raw' })).toBeChecked();
  expect(within(kcalBar()).getByText('107 / 3247')).toBeInTheDocument();
});

test('a failing source shows a message while the other still lists results', async () => {
  vi.mocked(searchFoods).mockResolvedValue({
    results: [banana],
    errors: [{ source: 'off', message: "Couldn't reach Open Food Facts" }],
  });
  const user = userEvent.setup();
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 2 (post-workout)' });
  await user.click(within(meal('Meal 2 (post-workout)')).getByRole('button', { name: '+ Add extra' }));
  await user.type(within(sheet()).getByRole('searchbox'), 'banana');
  expect(await within(sheet()).findByText("Couldn't reach Open Food Facts")).toBeInTheDocument();
  expect(within(sheet()).getByRole('button', { name: /Bananas, raw/ })).toBeInTheDocument();
});

test('your own foods match offline before any database result', async () => {
  vi.mocked(searchFoods).mockRejectedValue(new TypeError('Failed to fetch'));
  const user = userEvent.setup();
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 2 (post-workout)' });
  await user.click(within(meal('Meal 2 (post-workout)')).getByRole('button', { name: '+ Add extra' }));
  await user.type(within(sheet()).getByRole('searchbox'), 'chicken');
  expect(await within(sheet()).findByRole('button', { name: /Chicken Breast, cooked/ })).toBeInTheDocument();
  expect(await within(sheet()).findByText('Search is offline — showing your foods only')).toBeInTheDocument();
});
