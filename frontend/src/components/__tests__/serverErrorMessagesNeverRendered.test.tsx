/**
 * Raw server error text is never rendered (Equoria-0vm61, FRONTEND_ASYNC_STATE_DOCTRINE §4).
 *
 * Each surface below used to print the thrown error's `.message` verbatim, and
 * the api-client puts the server body's `message` on that error. A 500 whose
 * body carries internals (here a sentinel) therefore leaked to the player.
 *
 * The REAL components, hooks and api-client run; only the network boundary is
 * stubbed (MSW). Every surface must show the shared mapper's copy for a 5xx and
 * never the sentinel.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { MemoryRouter } from 'react-router';
import GroomHorseAction from '@/pages/horse-detail/GroomHorseAction';
import TrainingHistoryPanel from '@/components/training/TrainingHistoryPanel';
import GeneticsTab from '@/pages/horse-detail/GeneticsTab';
import type { Horse } from '@/pages/horse-detail/HorseDetailPageTypes';
import { userMessageFor } from '@/lib/http/userMessage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const sentinel = 'internal detail: connection reset by 10.0.0.7:5432, relation "horses"';
const serverFaultCopy = userMessageFor({ statusCode: 500 }).message;

function failEverythingWithSentinel() {
  server.use(
    http.get(`${base}/api/v1/*`, () =>
      HttpResponse.json({ success: false, message: sentinel }, { status: 500 })
    )
  );
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const horse: Horse = {
  id: 1,
  name: 'Moonflower',
  breed: 'Arabian',
  age: 5,
  gender: 'Mare',
  dateOfBirth: '2021-01-01',
  healthStatus: 'Good',
  stats: {
    precision: 1,
    strength: 1,
    speed: 1,
    agility: 1,
    endurance: 1,
    intelligence: 1,
    stamina: 1,
    balance: 1,
    boldness: 1,
    flexibility: 1,
    obedience: 1,
    focus: 1,
  },
  disciplineScores: {},
};

describe('server error text is mapped, never echoed (Equoria-0vm61)', () => {
  // The foal page and its FoalDevelopmentTracker are gone (owner ruling q71,
  // 2026-10-26: one horse page for life). The horse page's care read now
  // drives the Quick Actions Groom Horse press (Equoria-7dje4, which replaced
  // the Care area), so the press carries this guarantee: a failed care read is
  // said in the mapped copy with a Try Again, never as the server's text.
  it("the horse page's Groom Horse press never shows a failed care read's server text", async () => {
    failEverythingWithSentinel();
    renderWithQuery(
      <MemoryRouter>
        <GroomHorseAction horseId={77} />
      </MemoryRouter>
    );

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    expect(screen.getByTestId('groom-status-retry')).toBeInTheDocument();
    expect(screen.getByTestId('action-groom-horse')).toBeDisabled();
    expect(screen.queryByText(/connection reset by 10\.0\.0\.7/)).not.toBeInTheDocument();
  });

  it('TrainingHistoryPanel shows the mapped copy for both failed reads', async () => {
    failEverythingWithSentinel();
    renderWithQuery(<TrainingHistoryPanel horseId={5} />);

    const copies = await screen.findAllByText(serverFaultCopy);
    expect(copies).toHaveLength(2);
    expect(screen.queryByText(/connection reset by 10\.0\.0\.7/)).not.toBeInTheDocument();
  });

  it('GeneticsTab shows the mapped copy for a failed genetics read', async () => {
    failEverythingWithSentinel();
    renderWithQuery(<GeneticsTab horse={horse} />);

    expect(await screen.findByText(serverFaultCopy)).toBeInTheDocument();
    expect(screen.queryByText(/connection reset by 10\.0\.0\.7/)).not.toBeInTheDocument();
  });
});
