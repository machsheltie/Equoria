/**
 * StaffQuarantinedShows: the owner's Diagnose, Test run and Run show
 * (Equoria-ehlbj, Equoria-yqi49; owner rulings 2026-10-23 q29, q41)
 *
 * OLD contract (Equoria-ehlbj): Diagnose downloaded a JSON file; Run show was a
 * preview then Confirm with the preview digest. NEW ruling (q29 safeguards,
 * Equoria-yqi49): Diagnose shows a report with one Copy report button; Test run
 * runs the settlement and undoes it; Run show stays locked until a test run has
 * passed on the code running now. The download and preview tests changed with it.
 *
 * The real staff hooks over the real apiClient; MSW stubs the HTTP boundary.
 * The browser clipboard is the only thing replaced.
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
  lastTestRun: null,
  runShowReady: false,
};

const testRun = {
  showId: 41,
  passed: true,
  testedAt: '2026-10-29T00:00:00Z',
  commitSha: 'c0ffee',
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
  coinsIn: 1050,
  coinsOut: 1050,
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

  it('Diagnose shows the report and Copy report puts it on the clipboard', async () => {
    const report = '# Equoria: quarantined show 41 — diagnosis\nFailed tries (3, newest first)';
    server.use(
      http.get(`${STAFF}/shows/quarantined/41/diagnose`, () =>
        HttpResponse.json({ diagnosis: { showId: 41, commitSha: 'c0ffee', report } })
      )
    );
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Diagnose Autumn Classic' }));

    expect(await screen.findByLabelText('Diagnosis report')).toHaveValue(report);
    await user.click(screen.getByRole('button', { name: 'Copy report' }));
    expect(writeText).toHaveBeenCalledWith(report);
    expect(await screen.findByText('Copied.')).toBeInTheDocument();
  });

  it('Run show is locked until a test run passes; the test run shows what it would pay', async () => {
    let ran = false;
    let listCalls = 0;
    server.use(
      http.get(`${STAFF}/shows/quarantined`, () => {
        listCalls += 1;
        // After the test run the server reports Run show unlocked.
        return HttpResponse.json({
          shows: [
            listCalls > 1
              ? {
                  ...quarantined,
                  lastTestRun: { testedAt: testRun.testedAt, passed: true, sameCommit: true },
                  runShowReady: true,
                }
              : quarantined,
          ],
        });
      }),
      http.post(`${STAFF}/shows/quarantined/41/test-run`, () => HttpResponse.json({ testRun })),
      http.post(`${STAFF}/shows/quarantined/41/run`, () => {
        ran = true;
        return HttpResponse.json({ result: { showId: 41, status: 'completed', settled: 1 } });
      })
    );
    const user = userEvent.setup();
    renderSection();

    const runButton = await screen.findByRole('button', { name: 'Run Autumn Classic' });
    expect(runButton).toBeDisabled();
    expect(screen.getByText(/Run show unlocks after a test run passes/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Test run Autumn Classic' }));

    expect(await screen.findByText(/The test run passed and was undone/)).toBeInTheDocument();
    expect(screen.getByText(/Ember Glow/)).toBeInTheDocument();
    expect(screen.getByText('500 coins')).toBeInTheDocument();
    expect(
      screen.getByText(/The host receives 50 coins in entry fees and 500 coins of unpaid prize/)
    ).toBeInTheDocument();
    expect(ran).toBe(false);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Run Autumn Classic' })).toBeEnabled()
    );
    await user.click(screen.getByRole('button', { name: 'Run Autumn Classic' }));

    expect(await screen.findByText(/Autumn Classic has been run and paid/)).toBeInTheDocument();
    expect(ran).toBe(true);
  });

  it('a failed test run says so in words, never the raw server error, and Run show stays locked', async () => {
    server.use(
      http.post(`${STAFF}/shows/quarantined/41/test-run`, () =>
        HttpResponse.json({
          testRun: {
            showId: 41,
            passed: false,
            error: 'PrismaClientKnownRequestError P2025',
            commitSha: null,
          },
        })
      )
    );
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Test run Autumn Classic' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /The test run failed. Nothing was changed/
    );
    expect(screen.queryByText(/P2025/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Autumn Classic' })).toBeDisabled();
  });

  it('a run refused because the game was updated asks for a new test run', async () => {
    server.use(
      http.get(`${STAFF}/shows/quarantined`, () =>
        HttpResponse.json({
          shows: [
            {
              ...quarantined,
              runShowReady: true,
              lastTestRun: { testedAt: testRun.testedAt, passed: true, sameCommit: true },
            },
          ],
        })
      ),
      http.post(`${STAFF}/shows/quarantined/41/run`, () =>
        HttpResponse.json({ code: 'testRunStale', message: 'stale' }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Run Autumn Classic' }));

    expect(
      await screen.findByText(/since the last test run. Test run it again/)
    ).toBeInTheDocument();
  });
});

describe('StaffQuarantinedShows: the show is named in words (Equoria-2wdp8)', () => {
  it('names a conformation show by its kind, never the stored discipline code', async () => {
    const storedCode = 'conformation';
    server.use(
      http.get(`${STAFF}/shows/quarantined`, () =>
        HttpResponse.json({
          shows: [{ ...quarantined, discipline: storedCode, showType: storedCode }],
        })
      )
    );
    renderSection();

    const row = (await screen.findByText(/Autumn Classic/)).closest('li');
    expect(row).toHaveTextContent('Conformation,');
    expect(row?.textContent ?? '').not.toContain(storedCode);
  });
});
