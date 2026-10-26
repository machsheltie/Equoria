/**
 * GroomingReminder — home reminder for tonight's grooming (Equoria-akwyn,
 * Equoria-j765w.3; owner ruling q67, 2026-10-26).
 *
 * Real component, real useUngroomedToday hook, real apiClient; MSW stubs only
 * GET /api/v1/grooms/care/ungroomed-today in the care contract's v1 shape.
 * Proves: only the horses the server says are not yet groomed today are named,
 * each opening that horse's Care area (#care); a successful empty answer says so
 * honestly; a failed read shows an error with a working retry, never "nobody".
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { GroomingReminder } from '../GroomingReminder';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const url = `${base}/api/v1/grooms/care/ungroomed-today`;

const renderReminder = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GroomingReminder />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('GroomingReminder (Equoria-akwyn)', () => {
  it('names only the horses not yet groomed today, each opening its Care area', async () => {
    server.use(
      http.get(url, () =>
        HttpResponse.json({
          success: true,
          data: {
            horses: [
              { horseId: 21, horseName: 'Starling', isFoal: true, canGroomToday: true },
              { horseId: 5, horseName: 'Comet', isFoal: false, canGroomToday: false },
            ],
          },
        })
      )
    );
    renderReminder();

    const starling = await screen.findByRole('link', { name: 'Starling' });
    expect(starling).toHaveAttribute('href', '/horses/21#care');
    expect(screen.getByRole('link', { name: 'Comet' })).toHaveAttribute('href', '/horses/5#care');
    expect(screen.getByTestId('grooming-reminder')).toHaveTextContent(
      'Waiting to be groomed tonight: Starling and Comet.'
    );
    expect(screen.queryByText(/enrichment/i)).not.toBeInTheDocument();
  });

  it('folds a long list into "and N more"', async () => {
    const horses = Array.from({ length: 11 }, (_, i) => ({
      horseId: 100 + i,
      horseName: `Horse ${i + 1}`,
      isFoal: false,
      canGroomToday: true,
    }));
    server.use(http.get(url, () => HttpResponse.json({ success: true, data: { horses } })));
    renderReminder();

    expect(await screen.findByRole('link', { name: '3 more' })).toHaveAttribute('href', '/stable');
    expect(screen.getAllByRole('link')).toHaveLength(9);
  });

  it('says honestly that nobody is waiting, only after the server answers', async () => {
    server.use(http.get(url, () => HttpResponse.json({ success: true, data: { horses: [] } })));
    renderReminder();
    expect(screen.getByTestId('grooming-reminder-loading')).toBeInTheDocument();
    expect(
      await screen.findByText('No horse is waiting to be groomed tonight.')
    ).toBeInTheDocument();
  });

  it('shows an error with a working retry, never the empty line', async () => {
    let reads = 0;
    server.use(
      http.get(url, () => {
        reads += 1;
        return reads === 1
          ? HttpResponse.json({ success: false, message: 'secret internals' }, { status: 500 })
          : HttpResponse.json({
              success: true,
              data: {
                horses: [{ horseId: 3, horseName: 'Willow', isFoal: true, canGroomToday: true }],
              },
            });
      })
    );
    const user = userEvent.setup();
    renderReminder();

    expect(await screen.findByTestId('grooming-reminder-error')).toBeInTheDocument();
    expect(screen.queryByText(/No horse is waiting/)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret internals/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findByRole('link', { name: 'Willow' })).toHaveAttribute(
      'href',
      '/horses/3#care'
    );
  });
});
