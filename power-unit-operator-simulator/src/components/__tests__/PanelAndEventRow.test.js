import React from 'react';
import { render, screen } from '@testing-library/react';
import Panel from '../Panel';
import EventRow from '../EventRow';

describe('Panel component', () => {
  test('renders title, meta info and children', () => {
    render(
      <Panel
        title="Тестовая панель БЩУ"
        meta={<span data-testid="meta-badge">МЕТА</span>}
        className="custom-panel"
      >
        <p>Содержимое панели</p>
      </Panel>
    );

    expect(screen.getByText('Тестовая панель БЩУ')).toBeInTheDocument();
    expect(screen.getByTestId('meta-badge')).toBeInTheDocument();
    expect(screen.getByText('Содержимое панели')).toBeInTheDocument();
  });
});

describe('EventRow component', () => {
  test('renders student action event with OP code', () => {
    const event = {
      type: 'student',
      text: 'Оператор снизил уставку мощности',
      time: '18:10:00'
    };

    render(<EventRow event={event} />);

    expect(screen.getByText('OP')).toBeInTheDocument();
    expect(screen.getByText('Оператор снизил уставку мощности')).toBeInTheDocument();
    expect(screen.getByText('Действие оператора')).toBeInTheDocument();
    expect(screen.getByText('18:10:00')).toBeInTheDocument();
  });

  test('renders alarm event with ! code and alarm label', () => {
    const event = {
      type: 'alarm',
      text: 'Срабатывание АЗ-1',
      time: '18:12:30'
    };

    render(<EventRow event={event} />);

    expect(screen.getByText('!')).toBeInTheDocument();
    expect(screen.getByText('Срабатывание АЗ-1')).toBeInTheDocument();
    expect(screen.getByText('Сигнализация')).toBeInTheDocument();
  });
});
