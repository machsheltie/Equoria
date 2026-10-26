/**
 * One horse page for life (Equoria-jaeot, Equoria-q4uzh; owner ruling q71,
 * 2026-10-26).
 *
 * A four-day-old foal opens on the same horse page as any adult. The page says
 * her age in days (the old foal page showed whole game years times seven, so a
 * young foal read "0 days"), shows her bond, carries tonight's Care area with
 * the day's activities, and never mentions stress.
 *
 * Real HorseDetailPage with real hooks and apiClient; MSW stubs the HTTP
 * boundary. The horse's own reads are served in their real shapes; every other
 * read the page makes answers an empty success.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import HorseDetailPage from '../HorseDetailPage';
import { gameDateKey } from '@/lib/gameTime';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const foalId = 4242;

// Born four Eastern game days ago (the stored birth date is a calendar date).
const fourDaysAgo = gameDateKey(new Date(Date.now() - 4 * 86_400_000));

const foal = {
  id: foalId,
  name: 'TestFixture-Starling',
  breed: 'Arabian',
  age: 0,
  sex: 'Filly',
  gender: 'Filly',
  dateOfBirth: `${fourDaysAgo}T00:00:00.000Z`,
  healthStatus: 'Excellent',
  bondScore: 15,
  displayedHealth: 'Excellent',
  feedHealth: 'Good',
  stats: {},
  disciplineScores: {},
  traits: [],
};

function servePage() {
  server.use(
    http.get(`${base}/api/v1/horses/${foalId}`, () =>
      HttpResponse.json({ success: true, data: foal })
    ),
    http.get(`${base}/api/v1/horses/${foalId}/overview`, () =>
      HttpResponse.json({
        success: true,
        data: { lastShod: null, lastTrainedAt: null, lastGroomed: null, canGroomToday: true },
      })
    ),
    http.get(`${base}/api/v1/grooms/care/${foalId}`, () =>
      HttpResponse.json({
        success: true,
        data: {
          horseId: foalId,
          horseName: 'TestFixture-Starling',
          bond: 15,
          lastGroomedAt: null,
          groomedToday: false,
          canGroomToday: true,
          refusal: null,
          groom: { id: 7, name: 'Hazel Brook' },
          foal: {
            day: 5,
            band: {
              id: 'confidenceManners',
              label: 'Confidence, Manners and Weaning Readiness',
              firstDay: 5,
              lastDay: 7,
            },
            activities: [
              { id: 'confidenceWalk', label: 'Confidence Walk' },
              { id: 'mannersWeaning', label: 'Manners and Weaning Preparation' },
            ],
            todaysActivity: null,
          },
        },
      })
    ),
    // Everything else the page reads (trainer, riders, rare traits…): empty success.
    http.get(`${base}/api/v1/*`, () => HttpResponse.json({ success: true, data: null }))
  );
}

function renderPage(path = `/horses/${foalId}`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/horses/:id" element={<HorseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('HorseDetailPage for a foal (Equoria-jaeot)', () => {
  it("shows a four-day-old foal's age in days, her bond and tonight's Care area", async () => {
    servePage();
    renderPage();

    expect(await screen.findByTestId('horse-detail-age')).toHaveTextContent('Age: 4 days');
    expect(screen.getByTestId('horse-age')).toHaveTextContent('4 days old');
    expect(screen.getByTestId('horse-bond')).toHaveTextContent('15');

    const care = screen.getByTestId('horse-care');
    expect(await within(care).findByRole('radio', { name: 'Confidence Walk' })).toBeInTheDocument();
    expect(within(care).getByRole('button', { name: 'Groom TestFixture-Starling' })).toBeDisabled();

    expect(screen.queryByText(/stress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 days/)).not.toBeInTheDocument();
  });
});
