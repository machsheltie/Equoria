/**
 * The /guide route (Equoria-kd2dd)
 *
 * The Guide is a real route in the app's route table, reached from the one-time
 * welcome note and from its own link in the sidebar, right after News (owner
 * ruling 2026-10-23: the Guide link goes in the sidebar).
 */

import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { navItems } from '../nav-items';
import * as layoutNavigation from '../components/layout/navItems';
import { guideTitle } from '../constants/newPlayerGuide';

describe('/guide route (Equoria-kd2dd)', () => {
  it('is registered in the route table', () => {
    expect(navItems.some(({ to }) => to === '/guide')).toBe(true);
  });

  it('renders the Guide when the app routes to /guide', async () => {
    render(
      <MemoryRouter initialEntries={['/guide']}>
        <Suspense fallback={<p>Loading</p>}>
          <Routes>
            {navItems.map(({ to, Page }) => (
              <Route key={to} path={to} element={<Page />} />
            ))}
          </Routes>
        </Suspense>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { level: 1, name: guideTitle })).toBeInTheDocument();
  });

  it('is linked from the sidebar, right after News (owner ruling 2026-10-23)', () => {
    // The sidebar list is the navigation list that holds News; the bottom bar does not.
    const sidebar = Object.values(layoutNavigation)
      .filter((exported): exported is { name: string; href: string }[] => Array.isArray(exported))
      .find((list) => list.some(({ href }) => href === '/news'));
    expect(sidebar).toBeDefined();
    const hrefs = (sidebar ?? []).map(({ href }) => href);
    expect(hrefs[hrefs.indexOf('/news') + 1]).toBe('/guide');
    expect((sidebar ?? []).find(({ href }) => href === '/guide')?.name).toBe('Guide');
  });
});
