/**
 * "Ready to Train" counts only horses the train call would accept (Equoria-aycdv, STA-02)
 *
 * The Home header and the side panel counted every horse whose training
 * cooldown had passed, so foals, retired horses, horses in Bad health and
 * horses with no trainer read as ready. The count now comes from the server's
 * own verdict (GET /api/v1/training/trainable/:userId, `canTrain`), the same
 * rules the train call applies (age 3-20, health, trainer, cooldown).
 *
 * Real Index / AsidePanel, real hooks and API client; MSW only at the HTTP boundary.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import Index from '../Index';
import { AsidePanel } from '@/components/layout/AsidePanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// No training cooldown on any of them: by cooldown alone, all four are "ready".
const horses = [
  { id: 1, name: 'Little Comet', sex: 'Filly', age: 1, ageYears: 1 },
  { id: 2, name: 'Old Lantern', sex: 'Mare', age: 22, ageYears: 22 },
  { id: 3, name: 'Pale Ember', sex: 'Stallion', age: 7, ageYears: 7, displayedHealth: 'Bad' },
  { id: 4, name: 'Moonlit', sex: 'Mare', age: 6, ageYears: 6 },
];

const verdicts = [
  { id: 1, name: 'Little Comet', canTrain: false, ineligibleReason: 'Horse is under age' },
  { id: 2, name: 'Old Lantern', canTrain: false, ineligibleReason: 'Horse is too old to train' },
  { id: 3, name: 'Pale Ember', canTrain: false, ineligibleReason: 'Pale Ember is in bad health' },
  { id: 4, name: 'Moonlit', canTrain: true, ineligibleReason: null },
];

function stub(trainable: () => Response) {
  server.use(
    http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: horses })),
    http.get(`${base}/api/v1/training/trainable/:userId`, () => trainable())
  );
}

function renderHub(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider userOverrides={{ completedOnboarding: true }}>
        <MemoryRouter initialEntries={['/']}>{ui}</MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('Ready to Train counts (Equoria-aycdv)', () => {
  it('the side panel counts only the horse the server says can train', async () => {
    stub(() => HttpResponse.json({ success: true, data: verdicts }));
    renderHub(<AsidePanel />);

    const value = screen.getByText('Ready to Train').nextElementSibling as HTMLElement;
    await waitFor(() => expect(value).toHaveTextContent(/^1$/));
  });

  it('the side panel shows "—", not a count, when the verdict cannot load', async () => {
    stub(() => HttpResponse.json({ success: false, message: 'boom' }, { status: 500 }));
    renderHub(<AsidePanel />);

    await screen.findByText('Total Horses');
    await waitFor(() =>
      expect(screen.getByText('Total Horses').nextElementSibling).toHaveTextContent('4')
    );
    const value = screen.getByText('Ready to Train').nextElementSibling as HTMLElement;
    expect(value).toHaveTextContent('—');
  });

  it('the Home header says 1 ready to train, not 4', async () => {
    stub(() => HttpResponse.json({ success: true, data: verdicts }));
    renderHub(<Index />);

    const header = screen.getByTestId('page-header');
    await waitFor(() => expect(header).toHaveTextContent(/1\s+ready to train/));
    expect(header).not.toHaveTextContent(/4\s+ready to train/);
  });
});
