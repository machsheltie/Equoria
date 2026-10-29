/**
 * The horse page's Conformation tab shows the eight body regions only
 * (owner request 2026-10-29, Equoria-oxbda): no Overall Conformation card and
 * no percentile numbers, and the tab no longer asks the server for them.
 *
 * Real ConformationTab and real hooks; MSW at the HTTP boundary only.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import ConformationTab from '../ConformationTab';

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('Conformation tab regions (Equoria-oxbda)', () => {
  it('shows the eight body regions with no Overall card and no percentile numbers', async () => {
    const requested: string[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      requested.push(new URL(request.url).pathname);
    };
    server.events.on('request:start', onRequest);
    try {
      render(
        <QueryClientProvider client={client()}>
          <ConformationTab horseId={44} breedId={1} />
        </QueryClientProvider>
      );

      expect(await screen.findByTestId('conformation-score-card-head')).toBeInTheDocument();
      const regions = [
        'head',
        'neck',
        'shoulders',
        'back',
        'hindquarters',
        'legs',
        'hooves',
        'topline',
      ];
      for (const region of regions) {
        expect(screen.getByTestId(`conformation-score-card-${region}`)).toBeInTheDocument();
      }
      expect(screen.getAllByTestId(/^conformation-score-card-/)).toHaveLength(8);
      expect(
        screen.queryByTestId('conformation-score-card-overallConformation')
      ).not.toBeInTheDocument();
      // Region tooltips say "overall head proportion" etc.; no card or line
      // may name an Overall score.
      expect(screen.queryByRole('heading', { name: /overall/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/overall (conformation|score)/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/percentile/i)).not.toBeInTheDocument();
      expect(requested.some((path) => path.endsWith('/conformation/analysis'))).toBe(false);
    } finally {
      server.events.removeListener('request:start', onRequest);
    }
  });
});
