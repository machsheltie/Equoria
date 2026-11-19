/**
 * StaffOutage: the Owner's outage tools (Equoria-puj1e.5, owner rulings
 * q377/q378). The real hooks over the real apiClient; MSW stubs the HTTP
 * boundary with a small stateful fake of the staff routes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import StaffOutage from '../StaffOutage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const STAFF = `${base}/api/v1/staff`;

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const ok = (data: unknown) => HttpResponse.json({ success: true, data });
const refuse = (status: number, code: string) =>
  HttpResponse.json({ success: false, code, message: 'server words are never shown' }, { status });

const record = (id: number, reversedAt: string | null = null) => ({
  id,
  windowStart: '2026-11-15T14:00:00.000Z',
  windowEnd: '2026-11-17T14:00:00.000Z',
  pauseSeconds: 172_800,
  appliedAt: '2026-11-18T15:00:00.000Z',
  summary: { fields: { 'Horse.lastGroomed': 3 }, horsesUnretired: 1 },
  reversedAt,
  reverseSummary: null,
});

describe('StaffOutage', () => {
  let held: boolean;
  let list: ReturnType<typeof record>[];
  let posts: { url: string; body: unknown }[];
  let applyRefusal: { status: number; code: string } | null;

  beforeEach(() => {
    held = false;
    list = [];
    posts = [];
    applyRefusal = null;
    const hold = () => ({
      held,
      heldAt: held ? '2026-11-18T14:00:00.000Z' : null,
      heldById: null,
      reason: null,
    });
    const record$ = async (request: Request) => {
      posts.push({ url: new URL(request.url).pathname, body: await request.json() });
    };
    server.use(
      http.get(`${STAFF}/jobs/hold`, () => ok(hold())),
      http.post(`${STAFF}/jobs/hold`, async ({ request }) => {
        await record$(request);
        held = true;
        return ok(hold());
      }),
      http.post(`${STAFF}/jobs/release`, async ({ request }) => {
        await record$(request);
        held = false;
        return ok(hold());
      }),
      http.get(`${STAFF}/time-back`, () => ok(list)),
      http.get(`${STAFF}/time-back/preview`, () =>
        ok({
          windowStart: '2026-11-15T14:00:00.000Z',
          windowEnd: '2026-11-17T14:00:00.000Z',
          pauseSeconds: 172_800,
          pauseDays: 2,
          // Owner ruling q383 (2026-11-18): hunger moves like every other clock.
          fields: {
            'Horse.lastGroomed': 3,
            'Horse.dateOfBirth': 2,
            'Show.runDate': 0,
            'Horse.hungerSince': 4,
          },
          horsesUnretired: 1,
          jobRuns: [
            {
              jobName: 'nightlyShowExecution',
              startedAt: '2026-11-16T05:30:00.000Z',
              status: 'success',
              effect: 'Shows were run and their prizes paid.',
            },
          ],
          // A clock added later and not yet ruled on is still named, in words.
          unruledFields: ['Horse.futureClock'],
          overlapsTimeBackId: null,
        })
      ),
      http.post(`${STAFF}/time-back/code`, async ({ request }) => {
        await record$(request);
        return HttpResponse.json({ success: true }, { status: 202 });
      }),
      http.post(`${STAFF}/time-back/apply`, async ({ request }) => {
        await record$(request);
        if (applyRefusal) return refuse(applyRefusal.status, applyRefusal.code);
        list = [record(7)];
        return ok(list[0]);
      }),
      http.post(`${STAFF}/time-back/7/undo`, async ({ request }) => {
        await record$(request);
        list = [record(7, '2026-11-18T16:00:00.000Z')];
        return ok(list[0]);
      }),
      http.post(`${base}/api/v1/admin/foaling/trigger`, async ({ request }) => {
        await record$(request);
        return ok({ foalsBorn: 2, errors: [] });
      })
    );
  });

  const enterOutage = () => {
    fireEvent.change(screen.getByLabelText('Outage began (Eastern)'), {
      target: { value: '2026-11-15T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Outage ended (Eastern)'), {
      target: { value: '2026-11-17T09:00' },
    });
  };

  it('holds and releases the nightly jobs, and the line beside it changes', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);

    expect(await screen.findByText('The nightly jobs are running.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Why (optional)'), 'Server down');
    await user.click(screen.getByRole('button', { name: 'Hold the nightly jobs' }));
    expect(await screen.findByText(/The nightly jobs are held, since/)).toBeInTheDocument();
    expect(posts).toEqual([{ url: '/api/v1/staff/jobs/hold', body: { reason: 'Server down' } }]);

    await user.click(screen.getByRole('button', { name: 'Release the nightly jobs' }));
    expect(await screen.findByText('The nightly jobs are running.')).toBeInTheDocument();
  });

  it('shows what would move in words, never field or job names', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Show what moves' })).toBeDisabled();
    enterOutage();
    await user.click(screen.getByRole('button', { name: 'Show what moves' }));

    const preview = await screen.findByLabelText('What would move');
    expect(
      within(preview).getByText(
        /Gives back 2 days\. Moves 3 groomings, 2 birth dates, 4 hunger clocks\./
      )
    ).toBeInTheDocument();
    expect(
      within(preview).getByText(/1 horse that turned 21 during the outage goes back to 20/)
    ).toBeInTheDocument();
    expect(within(preview).getByText(/Shows were run and their prizes paid\./)).toBeInTheDocument();
    expect(
      within(preview).getByText(/Left alone until you rule on them: other dates\./)
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(
      /Horse\.|lastGroomed|nightlyShowExecution|hungerSince|futureClock/
    );
  });

  // Codex r2 #2/#3: when the record of which staff aged does not cover the
  // outage, their years are left alone, and the Owner reads that in words on
  // the preview and on the given-back entry.
  it('says plainly which career years cannot be given back, on the preview and the entry', async () => {
    const counters = ['Groom.careerWeeks', 'Rider.careerWeeks', 'Trainer.careerWeeks'];
    const words =
      "Can't be given back for this outage, because the record of which staff aged is incomplete: grooms’ years, riders’ years, trainers’ years. They stay as they are.";
    list = [
      {
        ...record(8),
        summary: {
          fields: { 'Horse.lastGroomed': 3 },
          horsesUnretired: 0,
          unprovableCounters: counters,
        },
      } as ReturnType<typeof record>,
    ];
    server.use(
      http.get(`${STAFF}/time-back/preview`, () =>
        ok({
          windowStart: '2026-11-15T14:00:00.000Z',
          windowEnd: '2026-11-17T14:00:00.000Z',
          pauseSeconds: 172_800,
          pauseDays: 2,
          fields: { 'Horse.lastGroomed': 3, 'Groom.careerWeeks': 0 },
          horsesUnretired: 0,
          jobRuns: [],
          unruledFields: [],
          unprovableCounters: counters,
          overlapsTimeBackId: null,
        })
      )
    );
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);

    enterOutage();
    await user.click(screen.getByRole('button', { name: 'Show what moves' }));
    const preview = await screen.findByLabelText('What would move');
    expect(within(preview).getByText(words)).toBeInTheDocument();
    expect(await screen.findAllByText(words)).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/careerWeeks|Groom\.|Rider\.|Trainer\./);
  });

  // Codex r2 #4: Eastern time has a 1:xx a.m. that happens twice (the night the
  // clocks go back, 1 Nov 2026) and a 2:xx a.m. that never happens (8 Mar 2026).
  const enterTimes = (began: string, ended: string) => {
    fireEvent.change(screen.getByLabelText('Outage began (Eastern)'), {
      target: { value: began },
    });
    fireEvent.change(screen.getByLabelText('Outage ended (Eastern)'), {
      target: { value: ended },
    });
  };

  it('asks which 1:xx a.m. only for a time that happened twice, and sends the choice', async () => {
    const previews: string[] = [];
    server.use(
      http.get(`${STAFF}/time-back/preview`, ({ request }) => {
        previews.push(new URL(request.url).search);
        return refuse(400, 'timeBackWindowInvalid');
      })
    );
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);

    enterOutage();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Show what moves' })).toBeEnabled();

    enterTimes('2026-11-01T01:15', '2026-11-01T02:15');
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByText('1:15 a.m. happened twice that night.')).toBeInTheDocument();
    const first = screen.getByRole('radio', { name: 'first 1:15 (before clocks went back)' });
    const second = screen.getByRole('radio', { name: 'second 1:15 (after)' });
    expect(first).not.toBeChecked();
    expect(second).not.toBeChecked();
    await user.type(screen.getByLabelText('Code from the email'), '123456');
    expect(screen.getByRole('button', { name: 'Show what moves' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Give the time back' })).toBeDisabled();

    await user.click(second);
    await user.click(screen.getByRole('button', { name: 'Show what moves' }));
    await screen.findByText('Enter when the outage began and ended; it must end after it began.');
    expect(previews).toEqual([
      '?start=2026-11-01T01%3A15&end=2026-11-01T02%3A15&startOccurrence=second',
    ]);
    await user.click(screen.getByRole('button', { name: 'Give the time back' }));
    await screen.findByRole('list', { name: 'Time given back' });
    expect(posts).toEqual([
      {
        url: '/api/v1/staff/time-back/apply',
        body: {
          start: '2026-11-01T01:15',
          end: '2026-11-01T02:15',
          startOccurrence: 'second',
          code: '123456',
        },
      },
    ]);

    // Changing the time asks again; a time that happened once asks nothing.
    enterTimes('2026-11-01T01:40', '2026-11-01T03:00');
    expect(
      screen.getByRole('radio', { name: 'first 1:40 (before clocks went back)' })
    ).not.toBeChecked();
    enterTimes('2026-11-01T03:00', '2026-11-01T04:00');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('refuses a time the clocks skipped, beside the field', () => {
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);
    enterTimes('2026-03-08T02:30', '2026-03-08T04:00');
    expect(
      screen.getByText(
        "That time doesn't exist on the night the clocks spring forward; pick a time outside 2:00–3:00 a.m."
      )
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Show what moves' })).toBeDisabled();
  });

  it('gives the time back with an emailed code; the new entry appears in the list', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);
    enterOutage();

    const give = screen.getByRole('button', { name: 'Give the time back' });
    expect(give).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Email me a code' }));
    expect(await screen.findByText('A code is on its way to your email.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Code from the email'), '123456');
    await user.click(give);

    const entries = await screen.findByRole('list', { name: 'Time given back' });
    expect(within(entries).getByText(/given back on/)).toBeInTheDocument();
    expect(within(entries).getByText(/Moved 3 groomings\./)).toBeInTheDocument();
    expect(posts).toEqual([
      { url: '/api/v1/staff/time-back/code', body: { purpose: 'timeBackApply' } },
      {
        url: '/api/v1/staff/time-back/apply',
        body: { start: '2026-11-15T09:00', end: '2026-11-17T09:00', code: '123456' },
      },
    ]);
  });

  it.each([
    [
      403,
      'staffFreshCodeInvalid',
      'That code is not right, or it has run out. Email yourself a new one.',
    ],
    [409, 'timeBackJobsNotHeld', 'Hold the nightly jobs first.'],
    [409, 'timeBackOverlaps', 'Part of this outage has already been given back.'],
  ])('a %s %s refusal is said in words beside the button', async (status, code, words) => {
    applyRefusal = { status, code };
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);
    enterOutage();
    await user.type(screen.getByLabelText('Code from the email'), '123456');
    await user.click(screen.getByRole('button', { name: 'Give the time back' }));

    expect(await screen.findByText(words)).toBeInTheDocument();
    expect(screen.queryByText('server words are never shown')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Time given back' })).not.toBeInTheDocument();
  });

  it('undoes a time-back with its own emailed code; the entry then says it was undone', async () => {
    list = [record(7)];
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);

    const entries = await screen.findByRole('list', { name: 'Time given back' });
    const undo = within(entries).getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    await user.click(within(entries).getByRole('button', { name: 'Email me an undo code' }));
    await user.type(within(entries).getByLabelText('Undo code'), '654321');
    await user.click(undo);

    expect(await within(entries).findByText(/Undone on/)).toBeInTheDocument();
    expect(within(entries).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(posts).toEqual([
      { url: '/api/v1/staff/time-back/code', body: { purpose: 'timeBackUndo' } },
      { url: '/api/v1/staff/time-back/7/undo', body: { code: '654321' } },
    ]);
  });

  it('delivers overdue foals and says how many', async () => {
    const user = userEvent.setup();
    renderWithClient(<StaffOutage onCheckinRequired={() => undefined} />);
    await user.click(screen.getByRole('button', { name: 'Deliver overdue foals now' }));
    expect(await screen.findByText('2 overdue foals delivered.')).toBeInTheDocument();
    expect(posts).toEqual([{ url: '/api/v1/admin/foaling/trigger', body: {} }]);
  });
});
