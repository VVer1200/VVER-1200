import React from 'react';
import { render, screen } from '@testing-library/react';
import TelemetryCard from '../TelemetryCard';

describe('TelemetryCard component', () => {
  test('renders label, value, unit and range', () => {
    render(
      <TelemetryCard
        label="Мощность реактора"
        value={100.0}
        unit="%"
        range="Рабочий диапазон 95–105%"
        state="normal"
      />
    );

    expect(screen.getByText('Мощность реактора')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(screen.getByText('Рабочий диапазон 95–105%')).toBeInTheDocument();
  });

  test('applies warning and danger modifier classes', () => {
    const { container: c1 } = render(
      <TelemetryCard label="Давление I контура" value={17.8} unit="МПа" range="Норма 16.2" state="danger" />
    );
    expect(c1.querySelector('.telemetry-card')).toHaveClass('danger');

    const { container: c2 } = render(
      <TelemetryCard label="Температура" value={332} unit="°C" range="Норма 328" state="warning" />
    );
    expect(c2.querySelector('.telemetry-card')).toHaveClass('warning');
  });
});
