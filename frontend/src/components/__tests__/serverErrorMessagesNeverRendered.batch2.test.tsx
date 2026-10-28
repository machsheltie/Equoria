/**
 * Raw server error text is never rendered, second batch (Equoria-mr1kq,
 * FRONTEND_ASYNC_STATE_DOCTRINE §4).
 *
 * Each read surface below printed the thrown error's `.message` verbatim, and
 * the api-client puts the server body's `message` on that error. A 500 whose
 * body carries internals (here a sentinel) therefore reached the player. The
 * REAL components, hooks and api-client run; only the network is stubbed (MSW).
 * Each surface must show the shared mapper's server-fault copy, never the
 * sentinel.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { server } from '@/test/msw/server';
import { userMessageFor } from '@/lib/http/userMessage';
import ConformationTab from '@/components/horse/ConformationTab';
import GaitsTab from '@/components/horse/GaitsTab';
import XpProgressBar from '@/components/horse/XpProgressBar';
import TemperamentReferenceModal from '@/components/horse/TemperamentReferenceModal';
import MilestoneEvaluationDisplay from '@/components/foal/MilestoneEvaluationDisplay';
import CompetitionResultsModal from '@/components/competition/CompetitionResultsModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const sentinel = 'internal detail: connection reset by 10.0.0.7:5432, relation "horses"';
const serverFaultCopy = userMessageFor({ statusCode: 500 }).message;

function failEverythingWithSentinel() {
  server.use(
    http.all(`${base}/api/v1/*`, () =>
      HttpResponse.json({ success: false, message: sentinel }, { status: 500 })
    )
  );
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const surfaces: Array<[string, () => React.ReactElement]> = [
  ['ConformationTab', () => <ConformationTab horseId={1} />],
  ['GaitsTab', () => <GaitsTab horseId={1} />],
  ['XpProgressBar', () => <XpProgressBar horseId={1} />],
  [
    'TemperamentReferenceModal',
    () => <TemperamentReferenceModal isOpen onClose={() => undefined} />,
  ],
  ['MilestoneEvaluationDisplay', () => <MilestoneEvaluationDisplay foalId={1} />],
  [
    'CompetitionResultsModal',
    () => <CompetitionResultsModal isOpen onClose={() => undefined} competitionId={7} />,
  ],
];

describe('server error text is mapped, never echoed (Equoria-mr1kq)', () => {
  it.each(surfaces)('%s shows the mapped copy for a failed read', async (_name, build) => {
    failEverythingWithSentinel();
    renderWithProviders(build());

    await waitFor(() => expect(document.body.textContent).toContain(serverFaultCopy));
    expect(screen.queryByText(/connection reset by 10\.0\.0\.7/)).not.toBeInTheDocument();
  });
});
