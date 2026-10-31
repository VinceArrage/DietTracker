import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Today heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
});
