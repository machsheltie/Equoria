/**
 * The /guide route (Equoria-kd2dd)
 *
 * The Guide is a real route in the app's route table, reached from the one-time
 * welcome note. Where its navigation link belongs is an open owner question, so
 * no navigation surface links to it yet; this test fails the moment one does
 * without that ruling being recorded here.
 */

import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { navItems } from '../nav-items';
import { BOTTOM_NAV_ITEMS, NAV_SECTIONS } from '../components/layout/navItems';
import { GUIDE_TITLE } from '../constants/newPlayerGuide';

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

    expect(await screen.findByRole('heading', { level: 1, name: GUIDE_TITLE })).toBeInTheDocument();
  });

  it('has no navigation link yet: its placement is an open owner question', () => {
    const linked = [...NAV_SECTIONS, ...BOTTOM_NAV_ITEMS].filter(({ href }) => href === '/guide');
    expect(linked).toEqual([]);
  });
});
