/**
 * The horse page's Conformation tab compares the horse with its own breed's
 * average (Equoria-uvgsz, audit HP-06): the page passes the breed, and a
 * breedless tab asks for no averages.
 *
 * Real HorseDetailPage / ConformationTab and real hooks; MSW at the HTTP
 * boundary only.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import ConformationTab from '../ConformationTab';
import HorseDetailPage from '@/pages/HorseDetailPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('Conformation tab breed average (HP-06)', () => {
  it('a breedless tab asks for no breed averages at all (HP-06)', async () => {
    const breedReads: string[] = [];
    server.use(
      http.get(`${base}/api/v1/breeds/:breedId/conformation-averages`, ({ params }) => {
        breedReads.push(String(params.breedId));
        return HttpResponse.json({ success: false, message: 'Breed not found' }, { status: 404 });
      })
    );
    render(
      <QueryClientProvider client={client()}>
        <ConformationTab horseId={42} />
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('conformation-tab')).toBeInTheDocument();
    expect(breedReads).toEqual([]);
  });

  it("the horse page compares the horse to its own breed's average (HP-06)", async () => {
    const breedReads: string[] = [];
    server.use(
      http.get(`${base}/api/v1/horses/43`, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 43,
            name: 'TestFixture-Wren',
            breed: { id: 4, name: 'Friesian' },
            breedId: 4,
            age: 6,
            ageYears: 6,
            sex: 'Mare',
            gender: 'Mare',
            dateOfBirth: '2026-09-01T00:00:00.000Z',
            healthStatus: 'Good',
            stats: {},
            disciplineScores: {},
            traits: [],
          },
        })
      ),
      http.get(`${base}/api/v1/breeds/:breedId/conformation-averages`, ({ params }) => {
        breedReads.push(String(params.breedId));
        return HttpResponse.json({
          success: true,
          data: {
            breedId: String(params.breedId),
            breedName: 'Friesian',
            averages: {
              head: 60,
              neck: 60,
              shoulders: 60,
              back: 60,
              hindquarters: 60,
              legs: 60,
              hooves: 60,
              topline: 60,
              overallConformation: 60,
            },
          },
        });
      })
    );
    render(
      <QueryClientProvider client={client()}>
        <MockAuthProvider>
          <MemoryRouter initialEntries={['/horses/43']}>
            <Routes>
              <Route path="/horses/:id" element={<HorseDetailPage />} />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    await userEvent.click(await screen.findByRole('tab', { name: 'Conformation' }));

    expect(await screen.findByTestId('breed-info-banner')).toHaveTextContent(
      'Comparing to Friesian Breed Average'
    );
    expect(breedReads).toContain('4');
    expect(breedReads).not.toContain('0');
  });
});
