import { render, screen } from '@testing-library/react';
import App from './App';

test('renders instructor dashboard', () => {
  render(<App />);
  expect(screen.getByText(/Текущее состояние энергоблока/i)).toBeInTheDocument();
});
