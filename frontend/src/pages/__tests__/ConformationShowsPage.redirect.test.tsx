/**
 * ConformationShowsPage redirect test (Equoria-8g4n / 31F-FE-3)
 *
 * After unifying conformation shows into CompetitionBrowserPage, the legacy
 * /conformation-shows route must still work — it now redirects to
 * /competitions?tab=conformation so bookmarks and in-app links keep
 * functioning instead of 404ing.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ConformationShowsPage from '../ConformationShowsPage';

function CompetitionsProbe() {
  const location = useLocation();
  return (
    <div data-testid="competitions-landing" data-search={location.search}>
      competitions
    </div>
  );
}

describe('ConformationShowsPage redirect (Equoria-8g4n)', () => {
  it('redirects /conformation-shows to /competitions?tab=conformation', () => {
    render(
      <MemoryRouter initialEntries={['/conformation-shows']}>
        <Routes>
          <Route path="/conformation-shows" element={<ConformationShowsPage />} />
          <Route path="/competitions" element={<CompetitionsProbe />} />
        </Routes>
      </MemoryRouter>
    );

    // The legacy route resolved to the unified competitions surface rather
    // than rendering a separate standalone conformation page.
    const landing = screen.getByTestId('competitions-landing');
    expect(landing).toBeInTheDocument();
    // The redirect deep-links straight to the conformation tab.
    expect(landing.getAttribute('data-search')).toBe('?tab=conformation');
    // The old standalone page surface must no longer render.
    expect(screen.queryByTestId('conformation-shows-page')).not.toBeInTheDocument();
  });
});
