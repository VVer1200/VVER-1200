import React from 'react';
import { render, screen } from '@testing-library/react';
import Topbar from '../Topbar';

describe('Topbar component', () => {
  test('renders title, subtitle and breadcrumbs', () => {
    render(
      <Topbar
        title="Мониторинг"
        subtitle="Панель контроля параметров"
        connectionStatus="connected"
      />
    );

    expect(screen.getByText('Мониторинг')).toBeInTheDocument();
    expect(screen.getByText('Панель контроля параметров')).toBeInTheDocument();
    expect(screen.getByText(/ЛАЭС \/ ТРЕНАЖЕР ВВЭР-1200 \/ МОНИТОРИНГ/i)).toBeInTheDocument();
    expect(screen.getByText('Рабочее место инструктора')).toBeInTheDocument();
  });

  test('displays connected status text when simulator is online', () => {
    render(
      <Topbar
        title="Главная"
        subtitle="Текущее состояние"
        connectionStatus="connected"
      />
    );
    expect(screen.getByText('Энергоблок ВВЭР-1200 в сети')).toBeInTheDocument();
    expect(screen.getByText('Телеметрия в реальном времени (20 Гц)')).toBeInTheDocument();
  });

  test('displays disconnected status text when simulator is offline', () => {
    render(
      <Topbar
        title="Главная"
        subtitle="Текущее состояние"
        connectionStatus="disconnected"
      />
    );
    expect(screen.getByText('Симулятор не подключен')).toBeInTheDocument();
    expect(screen.getByText('Запустите сервер симулятора (порт 3000)')).toBeInTheDocument();
  });
});
