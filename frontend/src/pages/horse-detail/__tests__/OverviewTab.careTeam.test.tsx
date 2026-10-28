import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../test/msw/server';
import { MemoryRouter } from '../../../test/utils';
import OverviewTab from '../OverviewTab';
import type { Horse } from '../HorseDetailPageTypes';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Owner request 2026-10-28 (Equoria-a6t0u): the horse page section that showed
 * the assigned trainer is now "Care Team", with three lines: Assigned Trainer,
 * Assigned Groom and Assigned Rider, at every age. With nobody assigned, a line
 * offers the same assign step the action bar does. The old contract was a
 * single "Trainer" panel at the foot of Horse Details.
 *
 * Driven through the real hooks against HTTP-level MSW overrides of the real
 * endpoints: trainer assignments, the horse's daily care status (its groom) and
 * rider assignments.
 */

const HORSE: Horse = {
  id: 7,
  name: 'TestFixture-Comet',
  breed: 'Thoroughbred',
  age: 5,
  gender: 'Mare',
  dateOfBirth: '2021-01-01T00:00:00Z',
  healthStatus: 'Excellent',
  stats: {} as Horse['stats'],
  disciplineScores: {},
  traits: [],
  displayedHealth: 'Good',
  feedHealth: 'Fair',
};

const trainerAssignment = {
  id: 5,
  trainerId: 10,
  horseId: 7,
  horseName: 'TestFixture-Comet',
  trainerName: 'TestFixture-Alice Thornton',
  trainerPersonality: 'focused',
  trainerSessionRate: 250,
  startDate: '2026-02-01T00:00:00Z',
  isActive: true,
};

const careStatus = (groom: { id: number; name: string; starLevel?: string } | null) => ({
  horseId: 7,
  horseName: 'TestFixture-Comet',
  bond: 0,
  lastGroomedAt: null,
  groomedToday: false,
  canGroomToday: Boolean(groom),
  refusal: groom
    ? null
    : { code: 'noGroomAssigned', message: 'This horse has no groom yet. Assign one to groom it.' },
  groom,
  foal: null,
});

const riderAssignment = {
  id: 12,
  riderId: 30,
  horseId: 7,
  horseName: 'TestFixture-Comet',
  riderName: 'TestFixture-Maya Reyes',
  startDate: '2026-02-01T00:00:00Z',
  isActive: true,
};

const staff = ({
  trainers = [] as unknown[],
  groom = null as { id: number; name: string; starLevel?: string } | null,
  riders = [] as unknown[],
} = {}) =>
  server.use(
    http.get(`${base}/api/v1/trainers/assignments`, () =>
      HttpResponse.json({ success: true, data: trainers })
    ),
    http.get(`${base}/api/v1/grooms/care/:horseId`, () =>
      HttpResponse.json({ success: true, data: careStatus(groom) })
    ),
    http.get(`${base}/api/v1/riders/assignments`, () =>
      HttpResponse.json({ success: true, data: riders })
    )
  );

const renderTab = (horse: Horse = HORSE, onAssignRider?: () => void) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <OverviewTab horse={horse} onAssignRider={onAssignRider} />
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('OverviewTab Care Team (Equoria-a6t0u)', () => {
  beforeEach(() => {
    server.use(
      http.get(`${base}/api/v1/horses/:id/overview`, () =>
        HttpResponse.json({
          success: true,
          data: { lastShod: null, lastTrainedAt: null, lastGroomed: null },
        })
      )
    );
  });

  it('is a "Care Team" section with Assigned Trainer, Assigned Groom and Assigned Rider, in that order', () => {
    staff();
    renderTab();
    const section = screen.getByRole('region', { name: 'Care Team' });
    const labels = within(section)
      .getAllByRole('term')
      .map((dt) => dt.textContent);
    expect(labels).toEqual(['Assigned Trainer', 'Assigned Groom', 'Assigned Rider']);
    // The old lone "Trainer" panel is gone.
    expect(screen.queryByTestId('horse-trainer-panel')).not.toBeInTheDocument();
  });

  it.each([0, 2, 5, 25])('shows all three lines for a horse aged %i', (age) => {
    staff();
    renderTab({ ...HORSE, age });
    const section = screen.getByRole('region', { name: 'Care Team' });
    expect(within(section).getAllByRole('term')).toHaveLength(3);
  });

  it('names the assigned trainer, groom and rider', async () => {
    staff({
      trainers: [trainerAssignment],
      groom: { id: 3, name: 'TestFixture-Rosa Bell' },
      riders: [riderAssignment],
    });
    renderTab();

    const trainerLink = await screen.findByTestId('care-team-trainer-link');
    expect(trainerLink).toHaveTextContent('TestFixture-Alice Thornton');
    expect(trainerLink).toHaveAttribute('href', '/trainers/10');
    expect(screen.getByTestId('care-team-trainer')).toHaveTextContent('per session');

    expect(await screen.findByText('TestFixture-Rosa Bell')).toBeInTheDocument();
    // Equoria-67yn9 (owner ruling 2026-10-28): the groom line also carries Last
    // Groomed. Old contract: the line was the groom's name alone.
    expect(screen.getByTestId('care-team-groom')).toHaveTextContent(
      /^TestFixture-Rosa Bell(?: Last Groomed: .+)?$/
    );

    expect(await screen.findByText('TestFixture-Maya Reyes')).toBeInTheDocument();
    expect(screen.getByTestId('care-team-rider')).toHaveTextContent(/^TestFixture-Maya Reyes$/);
  });

  // Owner ruling 2026-10-28 (Equoria-nawn5): staff show their star level with the name,
  // as the authored label and stars; assistive technology hears e.g. "Advanced, 4 stars".
  it("shows each staff member's star level beside the name", async () => {
    staff({
      trainers: [{ ...trainerAssignment, trainerStarLevel: 'advanced' }],
      groom: { id: 3, name: 'TestFixture-Rosa Bell', starLevel: 'rookie' },
      riders: [{ ...riderAssignment, riderStarLevel: 'expert' }],
    });
    renderTab();

    await screen.findByTestId('care-team-trainer-link');
    const trainerLine = screen.getByTestId('care-team-trainer');
    expect(within(trainerLine).getByTestId('staff-level')).toHaveTextContent(
      'Advanced★★★★, 4 stars'
    );
    expect(within(trainerLine).getByText('★★★★')).toHaveAttribute('aria-hidden', 'true');

    await screen.findByText('TestFixture-Rosa Bell');
    const groomLine = screen.getByTestId('care-team-groom');
    expect(within(groomLine).getByTestId('staff-level')).toHaveTextContent('Rookie★, 1 star');

    await screen.findByText('TestFixture-Maya Reyes');
    const riderLine = screen.getByTestId('care-team-rider');
    expect(within(riderLine).getByTestId('staff-level')).toHaveTextContent('Expert★★★★★, 5 stars');
    // Never the stored word.
    expect(screen.queryByText(/advanced|rookie|expert/)).not.toBeInTheDocument();
  });

  it("shows only this horse's rider, never another horse's", async () => {
    staff({ riders: [{ ...riderAssignment, horseId: 99, horseName: 'TestFixture-Other' }] });
    renderTab();
    expect(await screen.findByText(/No rider assigned/)).toBeInTheDocument();
    expect(screen.queryByText('TestFixture-Maya Reyes')).not.toBeInTheDocument();
  });

  it('offers the assign step on each line when nobody is assigned', async () => {
    staff();
    const onAssignRider = vi.fn();
    renderTab(HORSE, onAssignRider);

    const trainerLine = screen.getByTestId('care-team-trainer');
    expect(await within(trainerLine).findByText(/No trainer assigned\./)).toBeInTheDocument();
    expect(within(trainerLine).getByRole('link', { name: 'Assign Trainer' })).toHaveAttribute(
      'href',
      '/trainers?horseId=7'
    );

    const groomLine = screen.getByTestId('care-team-groom');
    expect(await within(groomLine).findByText(/No groom assigned\./)).toBeInTheDocument();
    expect(within(groomLine).getByRole('link', { name: 'Assign Groom' })).toHaveAttribute(
      'href',
      '/grooms?horseId=7'
    );

    const riderLine = screen.getByTestId('care-team-rider');
    expect(await within(riderLine).findByText(/No rider assigned\./)).toBeInTheDocument();
    await userEvent.click(within(riderLine).getByRole('button', { name: 'Assign Rider' }));
    expect(onAssignRider).toHaveBeenCalledTimes(1);
  });

  it('links Assign Rider to Riders when the page has no rider picker', async () => {
    staff();
    renderTab();
    const riderLine = screen.getByTestId('care-team-rider');
    expect(await within(riderLine).findByRole('link', { name: 'Assign Rider' })).toHaveAttribute(
      'href',
      '/riders'
    );
  });

  it('shows a failed line with Try Again while the other lines still load', async () => {
    let riderCalls = 0;
    staff({ trainers: [trainerAssignment], groom: { id: 3, name: 'TestFixture-Rosa Bell' } });
    server.use(
      http.get(`${base}/api/v1/riders/assignments`, () => {
        riderCalls += 1;
        return riderCalls === 1
          ? HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
          : HttpResponse.json({ success: true, data: [riderAssignment] });
      })
    );
    renderTab();

    const riderLine = screen.getByTestId('care-team-rider');
    expect(await within(riderLine).findByRole('alert')).toBeInTheDocument();
    expect(riderLine).not.toHaveTextContent('No rider assigned');
    // One failed read never blanks the others.
    expect(await screen.findByText('TestFixture-Alice Thornton')).toBeInTheDocument();
    expect(await screen.findByText('TestFixture-Rosa Bell')).toBeInTheDocument();

    await userEvent.click(within(riderLine).getByRole('button', { name: 'Try Again' }));
    expect(await within(riderLine).findByText('TestFixture-Maya Reyes')).toBeInTheDocument();
  });

  it('shows a loading line, never a false "none assigned", while a read is in flight', () => {
    staff();
    renderTab();
    const groomLine = screen.getByTestId('care-team-groom');
    expect(within(groomLine).getByRole('status')).toHaveTextContent('Loading groom…');
    expect(groomLine).not.toHaveTextContent('No groom assigned');
  });
});
