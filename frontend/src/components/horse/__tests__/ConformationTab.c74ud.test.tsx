/**
 * Every region card on the Conformation tab carries its own tooltip text
 * (Equoria-c74ud): the tab names its regions 'shoulders' and 'topline', and
 * both used to fall back to the generic "Conformation assessment" line.
 *
 * Real ConformationTab and real hooks; MSW at the HTTP boundary only.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConformationTab from '../ConformationTab';

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe('Conformation tab region tooltips (Equoria-c74ud)', () => {
  it('gives the Shoulders and Topline cards their own tooltip text', async () => {
    render(
      <QueryClientProvider client={client()}>
        <ConformationTab horseId={44} breedId={1} />
      </QueryClientProvider>
    );

    const shoulders = await screen.findByTestId('conformation-score-card-shoulders');
    expect(within(shoulders).getByText(/connection to withers/i)).toBeInTheDocument();

    const topline = screen.getByTestId('conformation-score-card-topline');
    expect(within(topline).getByText(/withers over the back and loin/i)).toBeInTheDocument();

    expect(screen.queryByText(/conformation assessment for this region/i)).not.toBeInTheDocument();
  });
});
