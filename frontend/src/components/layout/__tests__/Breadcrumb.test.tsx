/**
 * Breadcrumb — a route's crumb is its name, never its raw path segment.
 * The Steward's Office showed "steward" until it had a label (Equoria-puj1e.1).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from '@/test/utils';
import { Breadcrumb } from '../Breadcrumb';

describe('Breadcrumb', () => {
  it("names the Steward's Office instead of showing the raw segment", () => {
    render(
      <MemoryRouter initialEntries={['/steward']}>
        <Breadcrumb />
      </MemoryRouter>
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(trail).getByText("The Steward's Office")).toBeInTheDocument();
    expect(within(trail).queryByText('steward')).not.toBeInTheDocument();
  });
});
