import React from 'react';
import { render, screen } from '@testing-library/react';
import ResultsPage from '../ResultsPage';
import { results } from '../../data/mockData';

describe('ResultsPage component', () => {
  test('renders summary statistics cards and results table', () => {
    render(<ResultsPage rows={results} />);

    expect(screen.getByText('ВСЕГО СЕССИЙ')).toBeInTheDocument();
    expect(screen.getByText('СРЕДНЯЯ ОЦЕНКА')).toBeInTheDocument();
    expect(screen.getByText('Архив тренировок и экзаменов')).toBeInTheDocument();

    expect(screen.getByText('Кузнецов Максим')).toBeInTheDocument();
    expect(screen.getByText('Петров Алексей')).toBeInTheDocument();
    expect(screen.getByText('Смирнова Анна')).toBeInTheDocument();
  });
});
