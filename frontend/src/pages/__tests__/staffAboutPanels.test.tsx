/**
 * The "About" panels on the Grooms, Riders and Trainers pages (Equoria-6xm6b).
 *
 * Owner rulings: staff never gain XP (2026-10-21); riders and grooms start as Rookies
 * and grow a star level as they complete shows, revealing hidden likes and dislikes
 * (2026-10-28, Equoria-xlw03); trainers keep the level they came with; each groom
 * costs one weekly fee at their star level; riders are charged one week at a time;
 * a groom never works on their own (the player presses Groom Horse each day); the
 * groom reputation/prestige system is retired. The panels used to promise staff XP,
 * career milestones, legacy certifications at Level 7+ and rider contract extensions.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import React from 'react';
import GroomsPage from '../GroomsPage';
import RidersPage from '../RidersPage';
import TrainersPage from '../TrainersPage';
import { MockAuthProvider } from '@/test/utils';

function renderPage(page: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter>{page}</MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

function aboutPanel(heading: string): string {
  const panel = screen.getByRole('heading', { name: heading }).closest('aside');
  expect(panel).not.toBeNull();
  return panel?.textContent ?? '';
}

const staleStaffClaims = /\bXP\b|milestone|prestige|certification|contract extension|Level \d/i;

describe('Staff "About" panels follow the owner rulings (Equoria-6xm6b)', () => {
  it('About Grooms: daily Groom Horse press, growth by shows, one weekly fee, no XP', () => {
    renderPage(<GroomsPage />);
    const text = aboutPanel('About Grooms');

    expect(text).toContain('A groom never works on their own');
    expect(text).toContain('press Groom Horse');
    expect(text).toContain(
      'Every groom starts as a Rookie and climbs a star level as they complete shows'
    );
    expect(text).toContain('A Rookie shows you only their personality');
    expect(text).toContain('Each groom costs one weekly fee at their star level');
    expect(text).not.toMatch(staleStaffClaims);
    expect(text).not.toMatch(/feeding/i);
  });

  it('About Riders: growth by shows, weekly fee one week at a time, no contract extensions', () => {
    renderPage(<RidersPage />);
    const text = aboutPanel('About Riders');

    expect(text).toContain('Every show a rider completes counts toward its next level');
    expect(text).toContain('charged one week at a time');
    expect(text).not.toMatch(staleStaffClaims);
  });

  it('About Trainers: trainers keep their star level, no XP or Level 7 certifications', () => {
    renderPage(<TrainersPage />);
    const text = aboutPanel('About Trainers');

    expect(text).toContain('Trainers keep the star level they came with');
    expect(text).not.toMatch(staleStaffClaims);
    expect(text).not.toMatch(/revealed through training sessions/i);
  });
});
