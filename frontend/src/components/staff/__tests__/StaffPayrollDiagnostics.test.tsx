/**
 * StaffPayrollDiagnostics and StaffServerHealth: the owner's payroll and server
 * panels (Equoria-brh8c, owner ruling 2026-10-28 q158).
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
import StaffPayrollDiagnostics from '../StaffPayrollDiagnostics';
import StaffServerHealth from '../StaffServerHealth';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

const groom = {
  staffType: 'groom',
  id: 7,
  name: 'Hazel Brightwater',
  starLevel: 'rookie',
  employerId: 'player-1',
  employerName: 'Willow',
  onStaff: true,
  unpaidSince: null,
  failureCount: 1,
  lastFailureAt: '2026-10-25T04:07:00Z',
};

const failure = {
  id: 91,
  at: '2026-10-25T04:07:00Z',
  source: 'weeklySettlement',
  weekKey: '2026-10-18',
  message: 'fixture',
  replayable: true,
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('StaffPayrollDiagnostics', () => {
  let searches: string[];

  beforeEach(() => {
    searches = [];
    server.use(
      http.get(`${STAFF}/payroll/staff`, ({ request }) => {
        searches.push(new URL(request.url).search);
        return HttpResponse.json({ staff: [groom] });
      }),
      http.get(`${STAFF}/payroll/groom/7/failures`, () =>
        HttpResponse.json({
          staffMember: groom,
          failures: [failure],
          lastTestRun: null,
          rerunReadyFailureId: null,
        })
      )
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists staff with logged failures, then searches riders by name', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffPayrollDiagnostics onCheckinRequired={() => undefined} />);

    expect(await screen.findByText(/Hazel Brightwater/)).toBeInTheDocument();
    expect(screen.getByText(/1 logged failure, with Willow/)).toBeInTheDocument();
    expect(searches[0]).toBe('?type=groom&q=');

    await user.selectOptions(screen.getByLabelText('Staff'), 'rider');
    await user.type(screen.getByLabelText('Name'), 'Ash');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(searches).toContain('?type=rider&q=Ash'));
  });

  it('Re-run is locked until a test run passes; the test run says what it would do in words', async () => {
    let failureReads = 0;
    let reran = false;
    server.use(
      http.get(`${STAFF}/payroll/groom/7/failures`, () => {
        failureReads += 1;
        return HttpResponse.json({
          staffMember: groom,
          failures: [failure],
          lastTestRun: null,
          rerunReadyFailureId: failureReads > 1 ? 91 : null,
        });
      }),
      http.post(`${STAFF}/payroll/groom/7/failures/91/test-run`, () =>
        HttpResponse.json({
          testRun: {
            failureId: 91,
            passed: true,
            testedAt: '2026-10-29T00:00:00Z',
            commitSha: 'c0ffee',
            outcome: 'cannotWork',
            amount: 0,
          },
        })
      ),
      http.post(`${STAFF}/payroll/groom/7/failures/91/rerun`, () => {
        reran = true;
        return HttpResponse.json({ result: { failureId: 91, outcome: 'cannotWork', amount: 0 } });
      })
    );
    const user = userEvent.setup();
    renderWithClient(<StaffPayrollDiagnostics onCheckinRequired={() => undefined} />);

    await user.click(await screen.findByRole('button', { name: 'Open Hazel Brightwater' }));
    const rerun = await screen.findByRole('button', {
      name: /^Re-run the sunday pay-week settlement/,
    });
    expect(rerun).toBeDisabled();
    expect(screen.getByText(/pay week starting 2026-10-18/)).toBeInTheDocument();
    expect(screen.queryByText('fixture')).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /^Test run the sunday pay-week settlement/ })
    );

    expect(
      await screen.findByText(/Hazel Brightwater's week is marked unpaid: they cannot work/)
    ).toBeInTheDocument();
    await waitFor(() => expect(rerun).toBeEnabled());
    await user.click(rerun);
    expect(await screen.findByText(/Re-run done\./)).toBeInTheDocument();
    expect(reran).toBe(true);
  });

  it('a refused re-run explains at the button, never the server text', async () => {
    server.use(
      http.get(`${STAFF}/payroll/groom/7/failures`, () =>
        HttpResponse.json({
          staffMember: groom,
          failures: [failure],
          lastTestRun: null,
          rerunReadyFailureId: 91,
        })
      ),
      http.post(`${STAFF}/payroll/groom/7/failures/91/rerun`, () =>
        HttpResponse.json(
          { success: false, code: 'testRunStale', message: 'server words' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderWithClient(<StaffPayrollDiagnostics onCheckinRequired={() => undefined} />);

    await user.click(await screen.findByRole('button', { name: 'Open Hazel Brightwater' }));
    await user.click(await screen.findByRole('button', { name: /^Re-run the sunday/ }));

    expect(
      await screen.findByText(/since the last test run\. Test run it again\./)
    ).toBeInTheDocument();
    expect(screen.queryByText('server words')).not.toBeInTheDocument();
  });

  it('Diagnose shows the report and Copy report puts it on the clipboard', async () => {
    const report = '# Equoria: payroll failures of groom 7 — diagnosis';
    server.use(
      http.get(`${STAFF}/payroll/groom/7/diagnose`, () =>
        HttpResponse.json({
          diagnosis: { staffType: 'groom', staffId: 7, commitSha: null, report },
        })
      )
    );
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    renderWithClient(<StaffPayrollDiagnostics onCheckinRequired={() => undefined} />);

    await user.click(await screen.findByRole('button', { name: 'Open Hazel Brightwater' }));
    await user.click(await screen.findByRole('button', { name: 'Diagnose Hazel Brightwater' }));

    expect(await screen.findByLabelText('Diagnosis report')).toHaveValue(report);
    await user.click(screen.getByRole('button', { name: 'Copy report' }));
    expect(writeText).toHaveBeenCalledWith(report);
  });
});

describe('StaffServerHealth', () => {
  it('says memory and speed in plain words and offers the report', async () => {
    server.use(
      http.get(`${STAFF}/server-health`, () =>
        HttpResponse.json({
          health: {
            commitSha: null,
            uptime: '2 hours, 5 minutes',
            memory: {
              totalMb: 310.5,
              usedMb: 180.2,
              reservedMb: 220,
              percentUsed: 82,
              outsideMb: 12,
              growing: false,
              watching: true,
              warnings: [],
              openTimers: 4,
            },
            speed: {
              since: '2026-10-29T10:00:00Z',
              requests: 1200,
              overOneSecond: 3,
              slowestRoutes: [
                {
                  route: 'GET /api/v1/horses/:id',
                  requests: 40,
                  averageMs: 820,
                  slowestMs: 2400,
                  overOneSecond: 3,
                },
              ],
              cachedAnswersPercent: 40,
              averagePackingMs: 2,
            },
            report: '# Equoria: server memory and speed',
          },
        })
      )
    );
    const user = userEvent.setup();
    renderWithClient(<StaffServerHealth onCheckinRequired={() => undefined} />);

    expect(
      await screen.findByText(/180.2 MB used of 220 MB set aside \(82%\)/)
    ).toBeInTheDocument();
    expect(screen.getByText('Memory is not growing steadily.')).toBeInTheDocument();
    expect(screen.getByText('GET /api/v1/horses/:id')).toBeInTheDocument();
    expect(screen.getByText(/820 ms on average, slowest 2400 ms/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Report for Claude Code' }));
    expect(await screen.findByLabelText('Diagnosis report')).toHaveValue(
      '# Equoria: server memory and speed'
    );
  });
});
