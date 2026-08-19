/**
 * HorseMarketplacePage — Browse filter wiring (Equoria-cvsfk)
 *
 * The Browse toolbar's text input is a NAME search (not the old breed
 * substring box), and the advanced panel gained Breed (Select fed by the real
 * breed list, sent as exact breedId) and Sex selects. These tests prove the
 * controls exist and that each one reaches the server as the right query
 * param — MSW captures the real request URLs through the real fetch pipeline
 * (no vi.mock of api-client, CLAUDE.md §3). Server-side filter behavior is
 * covered by backend/modules/marketplace/__tests__/browseListingsFilters.integration.test.mjs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import HorseMarketplacePage from '../HorseMarketplacePage';
import React from 'react';

const capturedParams: URLSearchParams[] = [];

function makeHandlers() {
  return [
    http.get('*/api/v1/auth/profile', () =>
      HttpResponse.json({
        status: 'success',
        data: {
          user: {
            id: 1,
            username: 'tester',
            email: 'tester@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            money: 1000,
          },
        },
      })
    ),
    http.get('*/api/v1/breeds', () =>
      HttpResponse.json({
        success: true,
        data: [
          { id: 7, name: 'TestFixture-Arabian', description: null },
          { id: 9, name: 'TestFixture-Friesian', description: null },
        ],
        count: 2,
      })
    ),
    http.get('*/api/v1/marketplace', ({ request }) => {
      capturedParams.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        success: true,
        data: {
          listings: [],
          pagination: { page: 1, totalPages: 1, total: 0 },
        },
      });
    }),
  ];
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HorseMarketplacePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const lastParams = () => capturedParams[capturedParams.length - 1];

describe('HorseMarketplacePage — Browse filter wiring (Equoria-cvsfk)', () => {
  beforeEach(() => {
    capturedParams.length = 0;
    server.use(...makeHandlers());
  });

  it('toolbar name search sends the name param to the server', async () => {
    const user = userEvent.setup();
    renderPage();

    const search = await screen.findByLabelText(/search horses by name/i);
    await user.type(search, 'Storm');

    await waitFor(() => {
      expect(lastParams()?.get('name')).toBe('Storm');
    });
  });

  it('advanced panel offers Breed (real breed list) and Sex; selections reach the server as breedId/sex', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /advanced filters/i }));

    const breedSelect = await screen.findByLabelText(/^breed$/i);
    // Options come from the breeds API, not a hardcoded list.
    expect(await screen.findByRole('option', { name: 'TestFixture-Arabian' })).toBeInTheDocument();
    await user.selectOptions(breedSelect, '7');
    await waitFor(() => {
      expect(lastParams()?.get('breedId')).toBe('7');
    });

    const sexSelect = screen.getByLabelText(/^sex$/i);
    await user.selectOptions(sexSelect, 'Mare');
    await waitFor(() => {
      const params = lastParams();
      expect(params?.get('sex')).toBe('Mare');
      // Composes with the previously chosen breed.
      expect(params?.get('breedId')).toBe('7');
    });
  });
});
