/**
 * The Constellation Thread (Equoria-3qjwz, owner ruling q96 option A).
 *
 * Home stays a page; an arrow beside it lets down a thread with the rooms
 * beneath it: Stable, Staff, Inventory, Bank. Stable is no longer top-level and
 * the top-level Riders link is gone. Real router, no mocks.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SidebarNav } from '../SidebarNav';
import { NavPanel } from '../NavPanel';

function renderSidebar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarNav />
    </MemoryRouter>
  );
}

const roomNames = () =>
  within(screen.getByTestId('home-rooms-thread'))
    .queryAllByRole('link')
    .map((link) => link.textContent);

describe('SidebarNav — Home thread', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('keeps Home a link to the home page', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  });

  it('starts drawn up: the rooms are hidden and the arrow says so', () => {
    renderSidebar();
    const arrow = screen.getByTestId('home-thread-toggle');
    expect(arrow).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
  });

  it('lets down Stable, Staff, Inventory and Bank, in that order, and draws them up again', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const arrow = screen.getByTestId('home-thread-toggle');

    await user.click(arrow);
    expect(arrow).toHaveAttribute('aria-expanded', 'true');
    expect(roomNames()).toEqual(['Stable', 'Staff', 'Inventory', 'Bank']);
    expect(screen.getByRole('link', { name: 'Staff' })).toHaveAttribute('href', '/staff');

    await user.click(arrow);
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
  });

  it('no longer lists Stable or Riders at the top level', () => {
    renderSidebar();
    const nav = screen.getByRole('navigation');
    expect(within(nav).queryByRole('link', { name: 'Riders' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Stable' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'World' })).toBeInTheDocument();
  });

  it('lets the thread down when the player arrives in a room, marking it current', () => {
    renderSidebar('/staff');
    expect(screen.getByTestId('home-thread-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Staff' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('remembers the thread let down across visits', async () => {
    const user = userEvent.setup();
    const first = renderSidebar();
    await user.click(screen.getByTestId('home-thread-toggle'));
    first.unmount();
    renderSidebar();
    expect(screen.getByTestId('home-thread-toggle')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('NavPanel — rooms under Home', () => {
  it('lists the rooms right after Home and no Riders link', () => {
    render(
      <MemoryRouter>
        <NavPanel isOpen onClose={() => {}} />
      </MemoryRouter>
    );
    const names = within(screen.getByRole('dialog'))
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(names.slice(0, 5)).toEqual(['Home', 'Stable', 'Staff', 'Inventory', 'Bank']);
    expect(names).not.toContain('Riders');
  });
});
