/**
 * The owner's stud standing (Equoria-q4uem.9; owner rulings q93 2026-10-26,
 * 2026-10-02 the fee is hers, 2026-10-23 stud from age 3).
 *
 * Real StudStanding, real hooks and apiClient; MSW at the HTTP boundary.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import StudStanding, { type StudStandingProps } from '../StudStanding';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const listingUrl = `${base}/api/v1/horses/5/stud-listing`;

function renderStanding(props: Partial<StudStandingProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StudStanding
        horseId={5}
        horseName="Thunder Orchard"
        ageYears={6}
        studStatus="Not at Stud"
        studFee={0}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe('StudStanding', () => {
  it('one three-way choice; choosing Public Stud shows the fee, and Save stands him there', async () => {
    const seen: unknown[] = [];
    server.use(
      http.post(listingUrl, async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json({
          success: true,
          data: { studStatus: 'At Public Stud', studFee: 750 },
        });
      })
    );
    const user = userEvent.setup();
    renderStanding();

    const group = screen.getByRole('radiogroup', { name: 'Stud standing' });
    expect(screen.getByRole('radio', { name: 'Not at stud' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(group).toBeInTheDocument();
    expect(screen.queryByLabelText('Stud fee')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Public Stud' }));
    const fee = screen.getByLabelText('Stud fee');
    await user.clear(fee);
    await user.type(fee, '750');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Thunder Orchard stands at Public Stud for 750.')
    ).toBeInTheDocument();
    expect(seen).toEqual([{ studFee: 750, mode: 'public' }]);
  });

  it('choosing Not at stud takes a standing stallion off stud at once', async () => {
    let deleted = 0;
    server.use(
      http.delete(listingUrl, () => {
        deleted += 1;
        return HttpResponse.json({
          success: true,
          data: { studStatus: 'Not at Stud', studFee: 0 },
        });
      })
    );
    const user = userEvent.setup();
    renderStanding({ studStatus: 'At Private Stud', studFee: 400 });

    expect(screen.getByRole('radio', { name: 'Private Stud' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByLabelText('Stud fee')).toHaveValue(400);
    await user.click(screen.getByRole('radio', { name: 'Not at stud' }));

    expect(
      await screen.findByText('Thunder Orchard is no longer standing at stud.')
    ).toBeInTheDocument();
    expect(deleted).toBe(1);
  });

  it('a stallion under 3 cannot stand at stud', () => {
    renderStanding({ ageYears: 2 });

    expect(screen.getByRole('radio', { name: 'Public Stud' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Private Stud' })).toBeDisabled();
    expect(screen.getByText('Thunder Orchard can stand at stud from age 3.')).toBeInTheDocument();
  });

  it('a refused save says why in authored words and keeps the typed fee', async () => {
    server.use(
      http.post(listingUrl, () =>
        HttpResponse.json(
          { success: false, code: 'stallionTooYoungForStud', message: 'RAW server words' },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderStanding();

    await user.click(screen.getByRole('radio', { name: 'Private Stud' }));
    const fee = screen.getByLabelText('Stud fee');
    await user.clear(fee);
    await user.type(fee, '300');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Thunder Orchard can stand at stud from age 3.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/RAW server words|stallionTooYoungForStud/)).not.toBeInTheDocument();
    expect(fee).toHaveValue(300);
  });
});
