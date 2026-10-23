/**
 * NotFoundPage (Equoria-bvddn.35).
 *
 * Old contract (STAFF-CR-17, owner ruling 2026-10-15): an address that is not a
 * page rendered nothing at all. Owner ruling 2026-10-23: a bad link shows an
 * in-world not-found page with a way home, and /steward for anyone who is not
 * staff shows that same page.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import NotFoundPage from '../NotFoundPage';

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Stable home</p>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('NotFoundPage (Equoria-bvddn.35)', () => {
  it('tells the player the address leads nowhere instead of rendering a blank page', () => {
    const { container } = renderAt('/an-old-bookmark');

    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByTestId('not-found-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /this trail leads nowhere/i })).toBeInTheDocument();
  });

  it('offers a way home that travels to the start of the game', async () => {
    const user = userEvent.setup();
    renderAt('/a/typo/in/the/address');

    await user.click(screen.getByRole('button', { name: /back to the stable yard/i }));

    expect(await screen.findByText('Stable home')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
  });

  it('never offers a retry or mentions an error: nothing failed, the address is simply not a page', () => {
    renderAt('/nowhere');

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(/try again|retry|went wrong|error/i)).not.toBeInTheDocument();
  });
});
