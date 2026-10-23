/**
 * StaffQuarantinedShows: the owner's Diagnose and two-step Run show
 * (Equoria-ehlbj, owner rulings 2026-10-23)
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 * The browser file download (Blob and object URL) is the only thing replaced.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffQuarantinedShows from '../StaffQuarantinedShows';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const quarantined = {
  id: 41,
  name: 'Autumn Classic',
  discipline: 'Dressage',
  showType: 'ridden',
  closeDate: '2026-10-20T00:00:00Z',
  executionAttempts: 3,
  prizeEscrow: 1000,
  feeEscrow: 50,
  entryCount: 1,
  updatedAt: '2026-10-22T00:00:00Z',
};

const preview = {
  showId: 41,
  name: 'Autumn Classic',
  kind: 'unexecuted',
  attempts: 3,
  entryCount: 1,
  placements: [
    {
      placement: 1,
      horseId: 9,
      horseName: 'Ember Glow',
      ownerName: 'Willow',
      score: 77,
      prize: 500,
    },
  ],
  prizeToPlacings: 500,
  unpaidPrizeShareToHost: 500,
  entryFeesToHost: 50,
  previewDigest: 'digest-abc',
};

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <StaffQuarantinedShows onCheckinRequired={() => undefined} />
    </QueryClientProvider>
  );
}

describe('StaffQuarantinedShows', () => {
  beforeEach(() => {
    server.use(
      http.get(`${STAFF}/shows/quarantined`, () => HttpResponse.json({ shows: [quarantined] }))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the held-back show with its tries and the escrow it holds', async () => {
    renderSection();

    expect(await screen.findByText(/Autumn Classic/)).toBeInTheDocument();
    expect(screen.getByText(/3 failed tries/)).toBeInTheDocument();
    expect(
      screen.getByText(/Holding 1,000 coins of prize and 50 coins of entry fees/)
    ).toBeInTheDocument();
  });

  it('says so when nothing is held back', async () => {
    server.use(http.get(`${STAFF}/shows/quarantined`, () => HttpResponse.json({ shows: [] })));
    renderSection();

    expect(await screen.findByText('No shows held back')).toBeInTheDocument();
  });

  it('Diagnose downloads the export as a file', async () => {
    server.use(
      http.get(`${STAFF}/shows/quarantined/41/diagnose`, () =>
        HttpResponse.json({
          diagnosis: { format: 'equoria-quarantined-show-diagnosis/1', attempts: 3 },
        })
      )
    );
    const created: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      created.push(blob as Blob);
      return 'blob:diagnosis';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Diagnose Autumn Classic' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(created).toHaveLength(1);
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(created[0]);
    });
    expect(text).toContain('equoria-quarantined-show-diagnosis/1');
  });

  it('Run show previews first, moves nothing, and settles only on Confirm with the previewed digest', async () => {
    let runBody: unknown = null;
    server.use(
      http.post(`${STAFF}/shows/quarantined/41/preview`, () => HttpResponse.json({ preview })),
      http.post(`${STAFF}/shows/quarantined/41/run`, async ({ request }) => {
        runBody = await request.json();
        return HttpResponse.json({ result: { showId: 41, status: 'completed', settled: 1 } });
      })
    );
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Run Autumn Classic' }));

    expect(await screen.findByText(/Nothing has moved yet/)).toBeInTheDocument();
    expect(screen.getByText(/Ember Glow/)).toBeInTheDocument();
    expect(screen.getByText('500 coins')).toBeInTheDocument();
    expect(
      screen.getByText(/The host receives 50 coins in entry fees and 500 coins of unpaid prize/)
    ).toBeInTheDocument();
    expect(runBody).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Confirm and run Autumn Classic' }));

    expect(await screen.findByText(/Autumn Classic has been run and paid/)).toBeInTheDocument();
    expect(runBody).toEqual({ previewDigest: 'digest-abc' });
  });

  it('a show that changed since the preview says so and keeps the preview open', async () => {
    server.use(
      http.post(`${STAFF}/shows/quarantined/41/preview`, () => HttpResponse.json({ preview })),
      http.post(`${STAFF}/shows/quarantined/41/run`, () =>
        HttpResponse.json({ code: 'previewStale', message: 'changed' }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Run Autumn Classic' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm and run Autumn Classic' }));

    expect(await screen.findByText(/changed or was already run/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm and run Autumn Classic' })
    ).toBeInTheDocument();
  });
});
