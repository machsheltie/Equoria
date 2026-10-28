/**
 * The main menu's five realms (Equoria-m5ml8, NAV-01).
 *
 * Owner ruling 2026-10-28 (decisions page q249) plus her same-day addition that
 * News and Guide belong under Community. Only places with a real page are
 * listed: the ruling's Breeding Specialist, Equestrian Tailor, Seasonal Events
 * and Parades have none yet. Real router, real sidebar and phone menu, no mocks.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { SidebarNav } from '../SidebarNav';
import { NavPanel } from '../NavPanel';
import { navRealms, currentMenuHref, navMenuHrefs } from '../navItems';
import { navItems as routeTable } from '../../../nav-items';

const ruling: Record<string, string[]> = {
  Home: ['Stable', 'Staff', 'Inventory', 'Bank', 'Settings', 'Profile'],
  World: [
    'Vet Clinic',
    'Farrier',
    'Tack Shop',
    'Feed Shop',
    'Training Center',
    'Premium Shop',
    'Leathersmith',
  ],
  Community: [
    'Message Boards',
    'Clubs',
    'Messages',
    'Leaderboards',
    'Hall of Fame',
    'News',
    'Guide',
  ],
  Marketplace: ['Horse Trader', 'Horse Marketplace', 'Grooms', 'Riders', 'Trainers'],
  Compete: ['Ridden Shows', 'Conformation Shows'],
};

/** Does the app's route table have a page at this path? */
function hasPage(href: string): boolean {
  const path = href.split('?')[0];
  return routeTable.some(({ to }) => to === path);
}

describe('main menu realms (owner ruling q249)', () => {
  it('is five realms in order, each holding the places the owner named', () => {
    expect(navRealms.map((realm) => realm.name)).toEqual(Object.keys(ruling));
    for (const realm of navRealms) {
      expect(realm.items.map((item) => item.name)).toEqual(ruling[realm.name]);
    }
  });

  it('links only to pages that exist', () => {
    for (const href of navMenuHrefs) expect(hasPage(href), href).toBe(true);
  });

  it('opens the Training Center at /training and Conformation Shows on their tab', () => {
    const world = navRealms.find((realm) => realm.id === 'world')!;
    const compete = navRealms.find((realm) => realm.id === 'compete')!;
    expect(world.items.find((item) => item.name === 'Training Center')?.href).toBe('/training');
    expect(compete.items.map((item) => item.href)).toEqual([
      '/competitions',
      '/competitions?tab=conformation',
    ]);
  });

  it('marks one place current, the most specific match', () => {
    expect(currentMenuHref('/marketplace/horses', '', navMenuHrefs)).toBe('/marketplace/horses');
    expect(currentMenuHref('/marketplace', '', navMenuHrefs)).toBe('/marketplace');
    expect(currentMenuHref('/competitions', '', navMenuHrefs)).toBe('/competitions');
    expect(currentMenuHref('/competitions', '?tab=conformation', navMenuHrefs)).toBe(
      '/competitions?tab=conformation'
    );
    expect(currentMenuHref('/', '', navMenuHrefs)).toBe('/');
  });
});

describe('SidebarNav — realm threads', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const placesUnder = (realmId: string) =>
    within(screen.getByTestId(`${realmId}-rooms-thread`))
      .queryAllByRole('link')
      .map((link) => link.textContent);

  it('lets each realm down on its own thread', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNav />
      </MemoryRouter>
    );
    for (const realm of navRealms) {
      const toggle = screen.getByTestId(`${realm.id}-thread-toggle`);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(placesUnder(realm.id)).toEqual(ruling[realm.name]);
    }
  });

  it('Compete has no page of its own: its heading is the button that opens it', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNav />
      </MemoryRouter>
    );
    expect(screen.queryByRole('link', { name: 'Compete' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Compete/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('opens the thread of the realm the player is in and marks only that place', () => {
    render(
      <MemoryRouter initialEntries={['/riders']}>
        <SidebarNav />
      </MemoryRouter>
    );
    expect(screen.getByTestId('marketplace-thread-toggle')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('link', { name: 'Riders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Marketplace' })).not.toHaveAttribute('aria-current');
    expect(screen.getByTestId('world-thread-toggle')).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('NavPanel — realms on the phone menu', () => {
  it('lists every realm followed by its places', () => {
    render(
      <MemoryRouter>
        <NavPanel isOpen onClose={() => {}} />
      </MemoryRouter>
    );
    const dialog = screen.getByRole('dialog');
    for (const realm of navRealms) {
      const group = within(dialog).getByRole('region', { name: realm.name });
      const names = within(group)
        .getAllByRole('link')
        .map((link) => link.textContent);
      expect(names).toEqual([...(realm.href ? [realm.name] : []), ...ruling[realm.name]]);
    }
  });
});
