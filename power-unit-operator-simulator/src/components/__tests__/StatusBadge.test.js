import React from 'react';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';

describe('StatusBadge component', () => {
  test('renders children text correctly', () => {
    render(<StatusBadge>Активен</StatusBadge>);
    expect(screen.getByText('Активен')).toBeInTheDocument();
  });

  test('applies default status-badge normal class', () => {
    const { container } = render(<StatusBadge>Норма</StatusBadge>);
    const badge = container.querySelector('.status-badge');
    expect(badge).toHaveClass('normal');
  });

  test('applies warning and danger classes correctly', () => {
    const { container: c1 } = render(<StatusBadge type="warning">Внимание</StatusBadge>);
    expect(c1.querySelector('.status-badge')).toHaveClass('warning');

    const { container: c2 } = render(<StatusBadge type="danger">Авария</StatusBadge>);
    expect(c2.querySelector('.status-badge')).toHaveClass('danger');
  });
});
