import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import JournalPage from '../JournalPage';
import { initialJournal, scenarios, operators } from '../../data/mockData';

describe('JournalPage component', () => {
  const mockSession = { mode: 'Тренировка', elapsed: 120 };
  const mockOperator = operators[0];
  const mockScenario = scenarios[0];

  test('renders journal header, operator name and scenario info', () => {
    render(
      <JournalPage
        journal={initialJournal}
        session={mockSession}
        operator={mockOperator}
        scenario={mockScenario}
      />
    );

    expect(screen.getByText('Тренировка: журнал действий')).toBeInTheDocument();
    expect(screen.getByText(mockOperator.name)).toBeInTheDocument();
    expect(screen.getByText(mockScenario.title)).toBeInTheDocument();
  });

  test('filters journal entries by category button click', () => {
    render(
      <JournalPage
        journal={initialJournal}
        session={mockSession}
        operator={mockOperator}
        scenario={mockScenario}
      />
    );

    expect(screen.getByText(/Оператор подтвердил готовность/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Инструктор' }));
    expect(screen.getByText(/Инструктор инициировал событие/i)).toBeInTheDocument();
    expect(screen.queryByText(/Оператор подтвердил готовность/i)).not.toBeInTheDocument();
  });
});
