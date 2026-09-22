import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '../Sidebar';

describe('Sidebar component', () => {
  test('renders navigation items', () => {
    render(<Sidebar page="dashboard" setPage={() => {}} connectionStatus="connected" />);

    expect(screen.getByText('Главная')).toBeInTheDocument();
    expect(screen.getByText('Планирование')).toBeInTheDocument();
    expect(screen.getByText('Мониторинг')).toBeInTheDocument();
    expect(screen.getByText('Журнал действий')).toBeInTheDocument();
    expect(screen.getByText('Результаты')).toBeInTheDocument();
    expect(screen.getByText('Сценарии')).toBeInTheDocument();
  });

  test('calls setPage when navigation button is clicked', () => {
    const handleSetPage = jest.fn();
    render(<Sidebar page="dashboard" setPage={handleSetPage} connectionStatus="connected" />);

    fireEvent.click(screen.getByText('Мониторинг'));
    expect(handleSetPage).toHaveBeenCalledWith('live');

    fireEvent.click(screen.getByText('Журнал действий'));
    expect(handleSetPage).toHaveBeenCalledWith('journal');
  });

  test('highlights currently active page button', () => {
    render(<Sidebar page="scenarios" setPage={() => {}} connectionStatus="connected" />);
    const button = screen.getByText('Сценарии').closest('button');
    expect(button).toHaveClass('active');
  });
});
