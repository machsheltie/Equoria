/**
 * CompetitionBrowserPage ?tab= URL sync tests (Equoria-o5hub.30)
 *
 * The unified Arena (Equoria-8g4n) keeps tab state in the ?tab= search param so
 * /conformation-shows can deep-link to /competitions?tab=conformation and
 * bookmarks survive. This is pure routing logic — clicking the conformation tab
 * must WRITE ?tab=conformation (with history replace, not push), and clicking
 * the ridden tab must DELETE the param (the ridden tab is the canonical default
 * and carries no query string).
 *
 * Strategy: real component, real CanonicalTabs, real useSearchParams via
 * MemoryRouter, real useCompetitions/useHorses through the default MSW handlers
 * (no vi.mock of our API client per CLAUDE.md §3). A location probe outside the
 * page observes the live search string and the router history depth so we prove
 * BOTH the param mutation AND the replace:true semantics, not just the surface.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import React from 'react';
import CompetitionBrowserPage from '../CompetitionBrowserPage';
import { MockAuthProvider } from '@/test/utils';

/**
 * Probe that surfaces the live router location so assertions can read the
 * search string and pathname the page mutates.
 */
function LocationProbe() {
  const location = useLocation();
  return (
    <div
      data-testid="location-probe"
      data-search={location.search}
      data-pathname={location.pathname}
    />
  );
}

/** Fires a single history back step, to prove replace-vs-push semantics. */
function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="go-back" onClick={() => navigate(-1)}>
      back
    </button>
  );
}

function renderPage(initialEntries: string[] = ['/competitions']) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <CompetitionBrowserPage />
          <LocationProbe />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('CompetitionBrowserPage — ?tab= URL sync (Equoria-o5hub.30)', () => {
  it('clicking the Conformation tab writes ?tab=conformation', async () => {
    const user = userEvent.setup();
    renderPage();

    // Ridden is the default — no tab param to begin with.
    const probe = screen.getByTestId('location-probe');
    expect(probe.getAttribute('data-search')).toBe('');

    // The tab nav renders in every page state (Equoria-8g4n) so it is reachable
    // even before the competition list resolves.
    await user.click(await screen.findByTestId('tab-conformation'));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe(
        '?tab=conformation'
      );
    });
    // The conformation entry surface is now the active panel.
    expect(screen.getByTestId('conformation-shows-panel')).toBeInTheDocument();
  });

  it('clicking the Ridden tab deletes the tab param (canonical default carries no query)', async () => {
    const user = userEvent.setup();
    // Deep-link straight into the conformation tab, as the legacy redirect does.
    renderPage(['/competitions?tab=conformation']);

    expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe(
      '?tab=conformation'
    );

    await user.click(await screen.findByTestId('tab-ridden'));

    await waitFor(() => {
      expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe('');
    });
  });

  it('a ?tab=conformation deep link opens the conformation panel on first render', async () => {
    renderPage(['/competitions?tab=conformation']);

    // No click — the param alone selects the conformation tab.
    expect(await screen.findByTestId('conformation-shows-panel')).toBeInTheDocument();
    expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe(
      '?tab=conformation'
    );
  });

  it('switching tabs REPLACES history (no new entry) so back returns to the entry BEFORE the page', async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Two history entries: an "elsewhere" page, then the competitions page.
    // If tab switches PUSHED, back would walk through tab states instead of
    // landing on /elsewhere. replace:true means the single competitions entry is
    // mutated in place, so one back step lands on /elsewhere.
    render(
      <QueryClientProvider client={qc}>
        <MockAuthProvider>
          <MemoryRouter initialEntries={['/elsewhere', '/competitions']} initialIndex={1}>
            <BackButton />
            <CompetitionBrowserPage />
            <LocationProbe />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    // Toggle the tab twice — would create 2 extra history entries if pushed.
    await user.click(await screen.findByTestId('tab-conformation'));
    await waitFor(() => {
      expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe(
        '?tab=conformation'
      );
    });
    await user.click(screen.getByTestId('tab-ridden'));
    await waitFor(() => {
      expect(screen.getByTestId('location-probe').getAttribute('data-search')).toBe('');
    });

    // A single back step must land on /elsewhere (proving no tab-state entries
    // were pushed onto the stack).
    await user.click(screen.getByTestId('go-back'));
    await waitFor(() => {
      expect(screen.getByTestId('location-probe').getAttribute('data-pathname')).toBe('/elsewhere');
    });
  });

  it('preserves an unrelated query param when toggling the tab', async () => {
    const user = userEvent.setup();
    // Carry an analytics-style param the tab logic must not clobber.
    renderPage(['/competitions?utm_source=newsletter']);

    await user.click(await screen.findByTestId('tab-conformation'));

    await waitFor(() => {
      const search = screen.getByTestId('location-probe').getAttribute('data-search') ?? '';
      const params = new URLSearchParams(search);
      expect(params.get('tab')).toBe('conformation');
      expect(params.get('utm_source')).toBe('newsletter');
    });

    // Toggling back to ridden drops only `tab`, keeps utm_source.
    await user.click(screen.getByTestId('tab-ridden'));
    await waitFor(() => {
      const search = screen.getByTestId('location-probe').getAttribute('data-search') ?? '';
      const params = new URLSearchParams(search);
      expect(params.get('tab')).toBeNull();
      expect(params.get('utm_source')).toBe('newsletter');
    });
  });
});
