/**
 * The horse page's Conformation tab: an older horse with no scores reads
 * "no scores", not an error (Equoria-nmjsr, audit HP-07).
 *
 * Real HorseDetailPage / ConformationTab and real hooks; MSW at the HTTP
 * boundary only. GET /horses/:id/conformation answers 200 with data: null for a
 * horse without scores (horseConformationController.getConformation).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import ConformationTab from '../ConformationTab';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('Conformation tab without scores (HP-07)', () => {
  it('a horse without conformation scores shows the no-scores panel, not an error (HP-07)', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/:horseId/conformation`, () =>
        HttpResponse.json({
          success: true,
          message: 'No conformation scores available for this horse',
          data: null,
        })
      )
    );
    render(
      <QueryClientProvider client={client()}>
        <ConformationTab horseId={41} />
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('conformation-no-data')).toBeInTheDocument();
    expect(screen.queryByTestId('conformation-error')).not.toBeInTheDocument();
  });
});
