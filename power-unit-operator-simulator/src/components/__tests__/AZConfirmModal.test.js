import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AZConfirmModal } from '../AZConfirmModal';
import { MockAZConfirmModal } from '../MockAZConfirmModal';

describe('AZConfirmModal Component (Боевая реализация)', () => {
  test('не рендерится, если isOpen = false', () => {
    const { container } = render(<AZConfirmModal isOpen={false} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  test('отображает окно и заголовок при isOpen = true', () => {
    render(<AZConfirmModal isOpen={true} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText(/ПОДТВЕРЖДЕНИЕ СБРОСА АЗ-1/i)).toBeInTheDocument();
  });

  test('кнопка «СБРОСИТЬ АЗ-1» заблокирована, пока чекбокс не взведен', () => {
    render(<AZConfirmModal isOpen={true} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    const submitBtn = screen.getByRole('button', { name: /СБРОСИТЬ АЗ-1/i });
    expect(submitBtn).toBeDisabled();

    // Взводим чекбокс
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(submitBtn).toBeEnabled();
  });

  test('клик по активной кнопке подтверждения вызывает onConfirm с SCRAM_MANUAL', () => {
    const onConfirmMock = jest.fn();
    render(<AZConfirmModal isOpen={true} onConfirm={onConfirmMock} onCancel={jest.fn()} />);
    
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /СБРОСИТЬ АЗ-1/i }));

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    expect(onConfirmMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'SCRAM_MANUAL' }));
  });

  test('клик по кнопке «Отмена» вызывает onCancel', () => {
    const onCancelMock = jest.fn();
    render(<AZConfirmModal isOpen={true} onConfirm={jest.fn()} onCancel={onCancelMock} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Отмена/i }));
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });
});

describe('MockAZConfirmModal Component (Подмена для автотестов)', () => {
  test('мгновенно вызывает onConfirm при isOpen = true без рендеринга DOM', () => {
    const onConfirmMock = jest.fn();
    const { container } = render(<MockAZConfirmModal isOpen={true} onConfirm={onConfirmMock} />);

    expect(container.firstChild).toBeNull();
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    expect(onConfirmMock).toHaveBeenCalledWith(expect.objectContaining({ isMocked: true, action: 'SCRAM_MANUAL' }));
  });
});
