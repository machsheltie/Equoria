/**
 * The temperament reference pop-up describes the temperament only
 * (Equoria-9kakx; owner ruling 2026-10-29 q291).
 *
 * The pop-up used to print a breed hint under every temperament ("Common in
 * Arabians and sensitive hot-blood breeds"). The server no longer sends one;
 * this pins that the pop-up never renders one either, even if a stale cached
 * response still carries the old field. The REAL component, hook and api-client
 * run; only the network is stubbed (MSW).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '@/test/msw/server';
import TemperamentReferenceModal from '@/components/horse/TemperamentReferenceModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const breedHint = 'Common in Arabians and sensitive hot-blood breeds';

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TemperamentReferenceModal
          isOpen
          onClose={() => undefined}
          highlightTemperament="Reactive"
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TemperamentReferenceModal gives no breed hints (q291)', () => {
  it('shows the description and groom fit, never a breed hint', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/temperament-definitions`, () =>
        HttpResponse.json({
          success: true,
          data: {
            count: 1,
            definitions: [
              {
                name: 'Reactive',
                description: 'Highly attuned to the environment.',
                prevalenceNote: breedHint,
                bestGroomPersonalities: ['gentle'],
              },
            ],
          },
        })
      )
    );

    renderModal();

    expect(await screen.findByText('Highly attuned to the environment.')).toBeInTheDocument();
    expect(screen.getByTestId('temperament-def-reactive')).toBeInTheDocument();
    expect(screen.queryByText(breedHint)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/breed/i);
  });
});
