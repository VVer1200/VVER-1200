import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateTrainingPage from '../CreateTrainingPage';
import { scenarios } from '../../data/mockData';

describe('CreateTrainingPage component', () => {
  test('renders training creation form with mode and scenarios', () => {
    render(<CreateTrainingPage scenarios={scenarios} onStart={() => {}} />);

    expect(screen.getByText('Параметры учебной сессии')).toBeInTheDocument();
    expect(screen.getByText('01 · Режим проведения')).toBeInTheDocument();
    expect(screen.getByText('04 · Уровень сложности')).toBeInTheDocument();
    expect(screen.getByText('05 · Учебный сценарий')).toBeInTheDocument();
  });

  test('switches mode between training and exam', () => {
    render(<CreateTrainingPage scenarios={scenarios} onStart={() => {}} />);

    const examButton = screen.getByRole('button', { name: /Экзамен/i });
    fireEvent.click(examButton);
    expect(examButton).toHaveClass('active');
    expect(screen.getByText('ЭКЗАМЕНАЦИОННЫЙ РЕЖИМ')).toBeInTheDocument();
  });

  test('submits selected parameters on start button click', () => {
    const handleStart = jest.fn();
    render(<CreateTrainingPage scenarios={scenarios} onStart={handleStart} />);

    const startBtn = screen.getByRole('button', { name: /ЗАПУСТИТЬ ТРЕНИРОВКА/i });
    fireEvent.click(startBtn);

    expect(handleStart).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'Тренировка',
        difficulty: 'Средняя',
        scenarioId: 'rcp'
      })
    );
  });
});
