/**
 * The phone bottom bar is the five realms (owner ruling 2026-10-28, q267).
 *
 * Home, World, Community, Marketplace and Compete, matching the menu. Each opens
 * its realm's list the way the phone menu shows it, and the realm the player is
 * in stays marked. Old contract: Home, Horses, Compete, Market links and a More
 * button. Real BottomNav and NavPanel wired as DashboardLayout wires them.
 */

import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { BottomNav } from '../BottomNav';
import { NavPanel } from '../NavPanel';
import { navRealms, type NavRealmId } from '../navItems';

function PhoneShell({ path = '/' }: { path?: string }) {
  const [realm, setRealm] = useState<NavRealmId | null>(null);
  return (
    <MemoryRouter initialEntries={[path]}>
      <BottomNav openRealm={realm} onRealmClick={setRealm} />
      <NavPanel isOpen={realm !== null} realm={realm} onClose={() => setRealm(null)} />
    </MemoryRouter>
  );
}

describe('BottomNav — the five realms (q267)', () => {
  it('shows Home, World, Community, Marketplace and Compete, in that order', () => {
    render(<PhoneShell />);
    const bar = screen.getByTestId('bottom-nav');
    expect(
      within(bar)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual(['Home', 'World', 'Community', 'Marketplace', 'Compete']);
    expect(within(bar).queryByRole('link')).not.toBeInTheDocument();
  });

  it('each realm opens its own list, as the phone menu shows it', async () => {
    const user = userEvent.setup();
    render(<PhoneShell />);
    for (const realm of navRealms) {
      const button = screen.getByTestId(`bottom-nav-${realm.id}`);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const dialog = screen.getByRole('dialog', { name: realm.name });
      const names = within(dialog)
        .getAllByRole('link')
        .map((link) => link.textContent);
      expect(names).toEqual([
        ...(realm.href ? [realm.name] : []),
        ...realm.items.map((item) => item.name),
      ]);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(button);
    }
  });

  it('marks the realm the player is in', () => {
    render(<PhoneShell path="/riders" />);
    expect(screen.getByTestId('bottom-nav-marketplace')).toHaveAttribute(
      'aria-current',
      'location'
    );
    expect(screen.getByTestId('bottom-nav-active-dot-marketplace')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-home')).not.toHaveAttribute('aria-current');
  });

  it('every realm button carries the 44px touch area', () => {
    render(<PhoneShell />);
    for (const realm of navRealms) {
      expect(screen.getByTestId(`bottom-nav-${realm.id}`)).toHaveClass('nav-touch-target');
    }
  });
});
