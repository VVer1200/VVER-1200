import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ScenariosPage from '../ScenariosPage';
import { scenarios } from '../../data/mockData';

describe('ScenariosPage component', () => {
  test('renders all scenarios cards with titles and descriptions', () => {
    render(<ScenariosPage scenarios={scenarios} setPage={() => {}} />);

    for (const scn of scenarios) {
      expect(screen.getByText(scn.title)).toBeInTheDocument();
      expect(screen.getByText(scn.description)).toBeInTheDocument();
    }
  });

  test('navigates to create training page when button is clicked', () => {
    const handleSetPage = jest.fn();
    render(<ScenariosPage scenarios={scenarios} setPage={handleSetPage} />);

    const buttons = screen.getAllByRole('button', { name: /Использовать/i });
    fireEvent.click(buttons[0]);
    expect(handleSetPage).toHaveBeenCalledWith('create');
  });
});
