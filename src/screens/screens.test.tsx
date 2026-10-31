import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { clear } from 'idb-keyval';
import { beforeEach, expect, test } from 'vitest';
import App from '../App';
import { toggleItem } from '../domain/day';
import { getOrCreateDay, loadPlan, localDateKey, saveDay } from '../storage/repo';

beforeEach(async () => {
  await clear();
  window.location.hash = '';
});

test('the tab bar navigates to the Plan screen', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('link', { name: 'Plan' }));
  expect(await screen.findByRole('heading', { name: 'Plan' })).toBeInTheDocument();
  expect(await screen.findByDisplayValue('Meal 6')).toBeInTheDocument();
});

test('changing the calorie goal saves to the plan and today, not to past days', async () => {
  const past = await getOrCreateDay('2020-01-01');
  window.location.hash = '#/plan';
  const user = userEvent.setup();
  render(<App />);
  const kcal = await screen.findByLabelText('Calories goal');
  await user.clear(kcal);
  await user.type(kcal, '3000');
  await user.click(screen.getByRole('button', { name: 'Save goals' }));
  expect(await screen.findByText('Goals saved')).toBeInTheDocument();
  expect((await loadPlan()).plan.goals.kcal).toBe(3000);
  expect((await getOrCreateDay(localDateKey(new Date()))).goals.kcal).toBe(3000);
  expect((await getOrCreateDay('2020-01-01')).goals.kcal).toBe(past.goals.kcal);

  await user.click(screen.getByRole('link', { name: 'Today' }));
  const bar = await screen.findByRole('group', { name: 'Calories' });
  expect(within(bar).getByText('0 / 3000')).toBeInTheDocument();
});

test('a plan food amount change applies to new days', async () => {
  window.location.hash = '#/plan';
  const user = userEvent.setup();
  render(<App />);
  const m3 = await screen.findByRole('region', { name: 'Plan meal 3' });
  await user.click(within(m3).getByRole('button', { name: 'Edit Chicken Breast, cooked' }));
  const qty = within(screen.getByRole('dialog')).getByLabelText('Amount');
  await user.clear(qty);
  await user.type(qty, '180');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
  expect(await within(m3).findByText('180 g')).toBeInTheDocument();
  expect((await loadPlan()).plan.meals[2]!.items[0]!.quantity).toBe(180);
  expect((await getOrCreateDay('2030-01-01')).meals[2]!.items[0]!.quantity).toBe(180);
});

test('history lists a past day with what was eaten', async () => {
  const day = await getOrCreateDay('2026-10-29');
  await saveDay(toggleItem(day, day.meals[0]!.items[0]!.id));
  window.location.hash = '#/history';
  const user = userEvent.setup();
  render(<App />);
  const link = await screen.findByRole('link', { name: /Thu 29 Oct/ });
  expect(link).toHaveTextContent('106 / 3247 kcal');
  await user.click(link);
  expect(await screen.findByRole('heading', { name: 'Thu 29 Oct' })).toBeInTheDocument();
  const m1 = screen.getByRole('region', { name: 'Meal 1 (pré-workout)' });
  expect(within(m1).getByText('Whey isolate').closest('li')).toHaveClass('row--checked');
});

test('importing an unsupported backup shows an error', async () => {
  window.location.hash = '#/settings';
  const user = userEvent.setup();
  render(<App />);
  const input = await screen.findByLabelText('Import backup');
  const file = new File([JSON.stringify({ schemaVersion: 2 })], 'old.json', { type: 'application/json' });
  await user.upload(input, file);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unsupported backup version');
});

test('the USDA key is saved in settings', async () => {
  window.location.hash = '#/settings';
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText('USDA API key'), 'my-key');
  await user.click(screen.getByRole('button', { name: 'Save key' }));
  expect(await screen.findByText('Key saved')).toBeInTheDocument();
  const { loadSettings } = await import('../storage/repo');
  expect((await loadSettings()).usdaKey).toBe('my-key');
});
