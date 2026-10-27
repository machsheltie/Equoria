/**
 * "Breed to <stallion> (<fee>)" and the mare picker (Equoria-q4uem.9).
 *
 * Owner rulings q91/q94/q106 (2026-10-26/27): the button names the fee; the
 * player picks a mare and that is the one click. Her own stallion: free and at
 * once. A Public Stud: at once, fee charged. A Private Stud: a request is sent,
 * and the button is disabled when she cannot afford the fee. No confirm page,
 * no foal preview, no before/after balance, no receipt.
 *
 * Real BreedToStallion, real hooks, real apiClient (CSRF included); MSW only at
 * the HTTP boundary, in the backend's response shapes.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import BreedToStallion, { type BreedToStallionProps } from '../BreedToStallion';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

const myHorses = [
  {
    id: 11,
    name: 'Wren',
    sex: 'Mare',
    ageYears: 5,
    breed: { id: 1, name: 'Friesian' },
    inFoal: false,
    breedingCooldownEndsAt: null,
    pendingStudRequest: null,
    displayedHealth: 'Good',
  },
  {
    id: 12,
    name: 'Pip',
    sex: 'Mare',
    ageYears: 6,
    breed: { id: 1, name: 'Friesian' },
    inFoal: true,
    breedingCooldownEndsAt: null,
    pendingStudRequest: null,
    displayedHealth: 'Good',
  },
  {
    id: 13,
    name: 'Sprig',
    sex: 'Mare',
    ageYears: 2,
    breed: { id: 1, name: 'Friesian' },
    inFoal: false,
    breedingCooldownEndsAt: null,
    pendingStudRequest: null,
    displayedHealth: 'Good',
  },
  {
    id: 14,
    name: 'Dove',
    sex: 'Mare',
    ageYears: 7,
    breed: { id: 1, name: 'Friesian' },
    inFoal: false,
    breedingCooldownEndsAt: future,
    pendingStudRequest: null,
    displayedHealth: 'Good',
  },
  {
    id: 15,
    name: 'Ash',
    sex: 'Mare',
    ageYears: 8,
    breed: { id: 1, name: 'Friesian' },
    inFoal: false,
    breedingCooldownEndsAt: null,
    pendingStudRequest: { id: 3, stallionId: 9, stallionName: 'Other' },
    displayedHealth: 'Good',
  },
  {
    id: 16,
    name: 'Clover',
    sex: 'Mare',
    ageYears: 5,
    breed: { id: 2, name: 'Welsh Cob' },
    inFoal: false,
    breedingCooldownEndsAt: null,
    pendingStudRequest: null,
    displayedHealth: 'Good',
  },
  {
    id: 17,
    name: 'Bram',
    sex: 'Stallion',
    ageYears: 5,
    breed: { id: 1, name: 'Friesian' },
    inFoal: false,
    breedingCooldownEndsAt: null,
    pendingStudRequest: null,
    displayedHealth: 'Good',
  },
];

const stallion = { id: 99, name: 'Moonrise Sonata', breed: 'Friesian' };

function serveHorses(data: unknown[] = myHorses) {
  server.use(http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data })));
}

function renderBreed(props: Partial<BreedToStallionProps> = {}, money = 5000) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ money }}>
        <MemoryRouter>
          <BreedToStallion
            stallion={stallion}
            kind="public"
            fee={500}
            ownerName="Alder Hollow"
            {...props}
          />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('BreedToStallion', () => {
  it('names the fee on the button and greys out mares who cannot go, saying why', async () => {
    serveHorses();
    const user = userEvent.setup();
    renderBreed();

    await user.click(screen.getByRole('button', { name: 'Breed to Moonrise Sonata (500)' }));
    const select = await screen.findByLabelText('Choose one of your mares');
    const options = within(select).getAllByRole('option');
    const byText = (text: RegExp) =>
      options.find((o) => text.test(o.textContent ?? '')) as HTMLOptionElement;

    expect(byText(/^Wren/).disabled).toBe(false);
    expect(byText(/Pip · already in foal/).disabled).toBe(true);
    expect(byText(/Sprig · under 3/).disabled).toBe(true);
    expect(byText(/Dove · resting until/).disabled).toBe(true);
    expect(byText(/Ash · a request is already waiting/).disabled).toBe(true);
    expect(byText(/Clover · a different breed/).disabled).toBe(true);
    expect(options.some((o) => /Bram/.test(o.textContent ?? ''))).toBe(false);
  });

  it('a Public Stud: choosing the mare books at once with the fee she saw, and says so in place', async () => {
    serveHorses();
    const seen: { body: unknown; csrf: string | null }[] = [];
    server.use(
      http.post(`${base}/api/v1/studs/99/bookings`, async ({ request }) => {
        seen.push({ body: await request.json(), csrf: request.headers.get('X-CSRF-Token') });
        return HttpResponse.json({
          success: true,
          data: { pregnancyStarted: true, newBalance: 4500 },
        });
      })
    );
    const user = userEvent.setup();
    renderBreed();

    await user.click(screen.getByRole('button', { name: /Breed to Moonrise Sonata/ }));
    await user.selectOptions(await screen.findByLabelText('Choose one of your mares'), '11');

    expect(
      await screen.findByText('Wren is in foal to Moonrise Sonata. The foal is due in 7 days.')
    ).toBeInTheDocument();
    expect(seen).toHaveLength(1);
    expect(seen[0].body).toEqual({ damId: 11, expectedStudFee: 500 });
    expect(seen[0].csrf).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Wren' })).toHaveAttribute('href', '/horses/11');
    expect(screen.queryByText(/4,?500/)).not.toBeInTheDocument();
    expect(screen.queryByText(/receipt|balance/i)).not.toBeInTheDocument();
  });

  it('a Private Stud: choosing the mare sends a request', async () => {
    serveHorses();
    const seen: unknown[] = [];
    server.use(
      http.post(`${base}/api/v1/studs/99/requests`, async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json({ success: true, data: { requestId: 7 } }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderBreed({ kind: 'private' });

    await user.click(screen.getByRole('button', { name: 'Breed to Moonrise Sonata (500)' }));
    await user.selectOptions(await screen.findByLabelText('Choose one of your mares'), '11');

    expect(
      await screen.findByText('Your request for Wren is with Alder Hollow.')
    ).toBeInTheDocument();
    expect(seen).toEqual([{ damId: 11, expectedStudFee: 500 }]);
  });

  it('q106: a Private request she cannot afford is disabled', () => {
    serveHorses();
    renderBreed({ kind: 'private' }, 499);

    expect(screen.getByRole('button', { name: 'Breed to Moonrise Sonata (500)' })).toBeDisabled();
    expect(screen.getByText('You need 500 coins to ask for Moonrise Sonata.')).toBeInTheDocument();
  });

  it('her own stallion: no fee on the button, and the pair is bred free', async () => {
    serveHorses();
    const seen: unknown[] = [];
    server.use(
      http.post(`${base}/api/v1/horses/foals`, async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json({ success: true, data: { pregnancyStarted: true } });
      })
    );
    const user = userEvent.setup();
    renderBreed({ kind: 'own', fee: 0, ownerName: null });

    await user.click(screen.getByRole('button', { name: 'Breed to Moonrise Sonata' }));
    await user.selectOptions(await screen.findByLabelText('Choose one of your mares'), '11');

    expect(
      await screen.findByText('Wren is in foal to Moonrise Sonata. The foal is due in 7 days.')
    ).toBeInTheDocument();
    expect(seen).toEqual([{ sireId: 99, damId: 11 }]);
  });

  it('a refusal is said in authored words, never the server message or code, and her choice stays', async () => {
    serveHorses();
    server.use(
      http.post(`${base}/api/v1/studs/99/requests`, () =>
        HttpResponse.json(
          { success: false, code: 'insufficientFunds', message: 'SERVER-SIDE-TEXT you need 500' },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    // The balance read said she could pay; the server, the authority, says no.
    renderBreed({ kind: 'private' });

    await user.click(screen.getByRole('button', { name: /Breed to Moonrise Sonata/ }));
    const select = await screen.findByLabelText('Choose one of your mares');
    await user.selectOptions(select, '11');

    expect(
      await screen.findByText("You don't have enough coins for this stud fee.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/SERVER-SIDE-TEXT|insufficientFunds/)).not.toBeInTheDocument();
    expect((select as HTMLSelectElement).value).toBe('11');
  });

  it('when her mares cannot load, it says so and Try again recovers', async () => {
    let failing = true;
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        failing
          ? HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
          : HttpResponse.json({ success: true, data: myHorses })
      )
    );
    const user = userEvent.setup();
    renderBreed();

    await user.click(screen.getByRole('button', { name: /Breed to Moonrise Sonata/ }));
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
    failing = false;
    await user.click(retry);

    await waitFor(() =>
      expect(screen.getByLabelText('Choose one of your mares')).toBeInTheDocument()
    );
  });

  it('with no mares at all, it says so', async () => {
    serveHorses([]);
    const user = userEvent.setup();
    renderBreed();

    await user.click(screen.getByRole('button', { name: /Breed to Moonrise Sonata/ }));
    expect(await screen.findByText('You have no mares in your stable yet.')).toBeInTheDocument();
  });
});
