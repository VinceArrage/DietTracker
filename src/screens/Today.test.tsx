import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { getOrCreateDay, loadPlan, saveDay, savePlan } from '../storage/repo';
import { setPortion } from '../domain/day';
import Today from './Today';

beforeEach(async () => {
  await clear();
});

afterEach(() => {
  vi.useRealTimers();
});

const meal = (name: string) => screen.getByRole('region', { name });
const kcalBar = () => screen.getByRole('group', { name: 'Calories' });

test('shows all six meals and an empty calorie total', async () => {
  render(<Today />);
  expect(await screen.findByRole('region', { name: 'Meal 6' })).toBeInTheDocument();
  expect(screen.getAllByRole('region')).toHaveLength(6);
  expect(within(kcalBar()).getByText('0 / 3247')).toBeInTheDocument();
  expect(within(kcalBar()).getByText('3247 to go')).toBeInTheDocument();
});

test('checking whey in meal 1 adds 106 kcal', async () => {
  const user = userEvent.setup();
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 1 (pré-workout)' });
  await user.click(within(meal('Meal 1 (pré-workout)')).getByRole('checkbox', { name: /Whey isolate/ }));
  expect(within(kcalBar()).getByText('106 / 3247')).toBeInTheDocument();
  expect(within(meal('Meal 1 (pré-workout)')).getByText('106 / 711 kcal')).toBeInTheDocument();
});

test('skipping meal 4 hides its foods and marks it skipped', async () => {
  const user = userEvent.setup();
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 4' });
  await user.click(within(meal('Meal 4')).getByRole('button', { name: 'Options for Meal 4' }));
  await user.click(screen.getByRole('menuitem', { name: 'Skip meal' }));
  expect(within(meal('Meal 4')).getByText('Skipped')).toBeInTheDocument();
  expect(within(meal('Meal 4')).queryByRole('checkbox')).not.toBeInTheDocument();
  await user.click(within(meal('Meal 4')).getByRole('button', { name: 'Options for Meal 4' }));
  await user.click(screen.getByRole('menuitem', { name: 'Unskip meal' }));
  expect(within(meal('Meal 4')).getAllByRole('checkbox')).toHaveLength(4);
});

test('the header says when today’s plan covers the goals', async () => {
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 6' });
  expect(screen.getByRole('status', { name: 'Plan check' })).toHaveTextContent('Your plan for today covers your goals');
});

test('skipping meal 4 shows how far short today’s plan now is', async () => {
  const user = userEvent.setup();
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 4' });
  await user.click(within(meal('Meal 4')).getByRole('button', { name: 'Options for Meal 4' }));
  await user.click(screen.getByRole('menuitem', { name: 'Skip meal' }));
  const check = screen.getByRole('status', { name: 'Plan check' });
  expect(check).toHaveTextContent('429 kcal');
  expect(check).toHaveTextContent('P 48 g');
  expect(check).toHaveTextContent('short');
});

test('a row changed for today shows what the plan says', async () => {
  const day = await getOrCreateDay(localToday());
  const chicken = day.meals[2]!.items[0]!;
  await saveDay(setPortion(day, chicken.id, { quantity: 200, unit: 'g' }));
  render(<Today />);
  const m3 = await screen.findByRole('region', { name: 'Meal 3' });
  expect(within(m3).getByText('200 g')).toBeInTheDocument();
  expect(within(m3).getByText('edited · plan 150 g')).toBeInTheDocument();
});

test('coming back after midnight rolls over to a fresh day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 30, 23, 59));
  const user = userEvent.setup();
  render(<Today />);
  await screen.findByRole('region', { name: 'Meal 1 (pré-workout)' });
  expect(screen.getByText('Fri 30 Oct')).toBeInTheDocument();
  await user.click(within(meal('Meal 1 (pré-workout)')).getByRole('checkbox', { name: /Whey isolate/ }));
  expect(within(kcalBar()).getByText('106 / 3247')).toBeInTheDocument();

  vi.setSystemTime(new Date(2026, 9, 31, 0, 1));
  await act(async () => {
    fireEvent(document, new Event('visibilitychange'));
  });
  expect(await screen.findByText('Sat 31 Oct')).toBeInTheDocument();
  expect(within(kcalBar()).getByText('0 / 3247')).toBeInTheDocument();
  expect((await getOrCreateDay('2026-10-30')).meals[0]!.items[0]!.checked).toBe(true);
});

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('rows show fiber and sugar on a second line', async () => {
  render(<Today />);
  const m4 = await screen.findByRole('region', { name: 'Meal 4' });
  expect(within(m4).getByText('Fiber 3.6 · Sugar 15.5')).toBeInTheDocument();
});

test('a row whose plan item was deleted shows as an extra and cannot update the plan', async () => {
  const day = await getOrCreateDay(localToday());
  expect(day.meals[2]!.items[0]!.foodId).toBe('chicken-breast-cooked');
  const { plan } = await loadPlan();
  await savePlan({ ...plan, meals: plan.meals.map((m, i) => (i === 2 ? { ...m, items: m.items.slice(1) } : m)) });
  const user = userEvent.setup();
  render(<Today />);
  const m3 = await screen.findByRole('region', { name: 'Meal 3' });
  const row = within(m3).getByText('Chicken Breast, cooked').closest('li')!;
  expect(within(row).getByText('extra')).toBeInTheDocument();
  await user.click(within(m3).getByRole('button', { name: 'Edit Chicken Breast, cooked' }));
  expect(within(screen.getByRole('dialog')).queryByRole('checkbox', { name: 'Also update my plan' })).not.toBeInTheDocument();
});
