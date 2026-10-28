/**
 * Quick Actions look like the gold Train / Enter Competition buttons, at their
 * own small size, and Enter Competition lives there (owner ruling 2026-10-28,
 * Equoria-k8wxl). The middle of the horse page no longer carries Train or
 * Enter Competition. Old contract: frosted secondary buttons in the bar and
 * two gold buttons ("Train This Horse", "Enter Competition") mid-page.
 *
 * Real HorseActionBar and HorseDetailPage with real hooks; MSW at the HTTP
 * boundary only.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import HorseActionBar from '../HorseActionBar';
import HorseDetailPage from '@/pages/HorseDetailPage';
import type { Horse } from '../HorseDetailPageTypes';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const horse = {
  id: 1,
  name: 'TestFixture-GoldBarHorse',
  forSale: false,
  lastFedDate: null,
  equippedFeedType: 'oats',
  feedHealth: 'good',
} as unknown as Horse;

const Where: React.FC = () => {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
};

function client() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe('Quick Actions are gold and carry Enter Competition (Equoria-k8wxl)', () => {
  it('every Quick Actions button is the gold primary at the small size', async () => {
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter>
          <HorseActionBar
            horse={horse}
            onAssignRider={() => {}}
            onListForSale={() => {}}
            refetch={() => {}}
          />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const bar = screen.getByTestId('horse-action-bar');
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(7);
    for (const button of buttons) {
      // Gold primary, as the Train / Enter Competition buttons were...
      expect(button.className).toContain('from-[var(--gold-primary)]');
      // ...not the frosted secondary...
      expect(button.className).not.toContain('glass-panel-subtle');
      // ...and still the bar's small size.
      expect(button.className).toContain('h-9');
    }
  });

  it('Enter Competition in Quick Actions opens competitions for this horse', async () => {
    render(
      <QueryClientProvider client={client()}>
        <MemoryRouter initialEntries={['/horses/1']}>
          <Routes>
            <Route
              path="/horses/:id"
              element={
                <HorseActionBar
                  horse={horse}
                  onAssignRider={() => {}}
                  onListForSale={() => {}}
                  refetch={() => {}}
                />
              }
            />
            <Route path="/competitions" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Enter Competition' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/competitions?horseId=1');
  });

  it('the middle of the horse page no longer carries Train or Enter Competition', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/1`, () =>
        HttpResponse.json({
          success: true,
          data: {
            ...horse,
            breed: 'Arabian',
            age: 5,
            sex: 'Mare',
            gender: 'Mare',
            dateOfBirth: '2026-09-01T00:00:00.000Z',
            healthStatus: 'Good',
            stats: {},
            disciplineScores: {},
            traits: [],
          },
        })
      )
    );
    render(
      <QueryClientProvider client={client()}>
        <MockAuthProvider>
          <MemoryRouter initialEntries={['/horses/1']}>
            <Routes>
              <Route path="/horses/:id" element={<HorseDetailPage />} />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    const bar = await screen.findByTestId('horse-action-bar');
    expect(screen.queryByRole('button', { name: /Train This Horse/ })).not.toBeInTheDocument();
    const enterButtons = screen.getAllByRole('button', { name: 'Enter Competition' });
    expect(enterButtons).toHaveLength(1);
    expect(bar).toContainElement(enterButtons[0]);
    expect(within(bar).getByTestId('action-train')).toBeInTheDocument();
  });
});
