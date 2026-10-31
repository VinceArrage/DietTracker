import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { History } from './History';
import PlanScreen from './Plan';

vi.mock('../storage/repo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../storage/repo')>();
  const fail = () => Promise.reject(new Error('IndexedDB unavailable'));
  return { ...real, loadPlan: fail, listDays: fail, loadFoods: fail };
});

test('Plan shows an error instead of loading forever when storage fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<PlanScreen />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your plan');
});

test('History shows an error instead of loading forever when storage fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<History />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your history');
});

test('a render crash shows a recovery screen instead of a blank app', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const Boom = () => {
    throw new Error('boom');
  };
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});
