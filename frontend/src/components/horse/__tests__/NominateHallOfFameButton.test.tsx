/**
 * The owner's Hall of Fame nomination button (Equoria-vb1n0, owner ruling 2026-10-28)
 *
 * A retired horse (21) shows "Nominate horse to the Hall of Fame" to its owner;
 * a horse can be nominated once, ever. Real component + hooks + apiClient; MSW
 * only at the HTTP boundary.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { NominateHallOfFameButton } from '../NominateHallOfFameButton';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const statusPath = `${base}/api/v1/hall-of-fame/horses/44`;
const nominatePath = `${base}/api/v1/hall-of-fame/nominations`;

function renderButton(ageYears: number) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <NominateHallOfFameButton horseId={44} horseName="Old Lantern" ageYears={ageYears} />
    </QueryClientProvider>
  );
}

describe('NominateHallOfFameButton (Equoria-vb1n0)', () => {
  it('a retired horse can be nominated once; then the button gives way', async () => {
    let nominated = false;
    server.use(
      http.get(statusPath, () =>
        HttpResponse.json({
          success: true,
          data: { canNominate: !nominated, nominated, inducted: false },
        })
      ),
      http.post(nominatePath, () => {
        nominated = true;
        return HttpResponse.json({ success: true, data: { id: 1, horseId: 44 } }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderButton(22);

    await user.click(
      await screen.findByRole('button', { name: 'Nominate horse to the Hall of Fame' })
    );

    expect(
      await screen.findByText('Old Lantern has been nominated to the Hall of Fame.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nominate horse to the Hall of Fame' })
    ).not.toBeInTheDocument();
  });

  it('shows nothing for a horse under 21, and asks the server nothing', async () => {
    let asked = false;
    server.use(
      http.get(statusPath, () => {
        asked = true;
        return HttpResponse.json({
          success: true,
          data: { canNominate: true, nominated: false, inducted: false },
        });
      })
    );
    const { container } = renderButton(20);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
    expect(asked).toBe(false);
  });

  it('says why when a nomination is refused', async () => {
    server.use(
      http.get(statusPath, () =>
        HttpResponse.json({
          success: true,
          data: { canNominate: true, nominated: false, inducted: false },
        })
      ),
      http.post(nominatePath, () =>
        HttpResponse.json(
          {
            success: false,
            message: 'This horse has already been nominated to the Hall of Fame.',
            code: 'alreadyNominated',
          },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderButton(25);

    await user.click(
      await screen.findByRole('button', { name: 'Nominate horse to the Hall of Fame' })
    );
    expect(await screen.findByText(/old lantern was not nominated/i)).toBeInTheDocument();
  });
});
