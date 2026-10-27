/**
 * The one horse page in visitor mode (Equoria-q4uem.9).
 *
 * Owner rulings q90 (same horse page, read-only: public facts, revealed traits
 * only, a "Standing at stud" plaque with fee, Public or Private, and owner),
 * q91 (a "Breed to <name> (<fee>)" button), q95/q107 (a stallion owner opening
 * a requesting mare accepts or rejects there).
 *
 * The real HorseDetailPage at /horses/:id: the owner-only read answers 404 for
 * another player's horse, and the page reads the visitor view instead. MSW at
 * the HTTP boundary only.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { MockAuthProvider } from '@/test/utils';
import HorseDetailPage from '@/pages/HorseDetailPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const visit = {
  id: 99,
  name: 'Moonrise Sonata',
  breed: 'Friesian',
  sex: 'Stallion',
  age: 7,
  colorName: 'Black',
  imageUrl: null,
  stats: {
    speed: 74,
    stamina: 81,
    agility: 69,
    precision: 70,
    strength: 77,
    intelligence: 77,
    boldness: 62,
  },
  revealedTraits: { positive: ['evenTempered'], negative: ['spooky'] },
  displayedHealth: 'Good',
  sire: { id: 50, name: 'Midnight Ledger' },
  dam: null,
  owner: { username: 'Alder Hollow' },
  isOwn: false,
  stud: { mode: 'private', fee: 500 },
  forSale: false,
  salePrice: null,
};

function serve(visitBody: unknown, visitStatus = 200) {
  server.use(
    http.get(`${base}/api/v1/horses/:id`, () =>
      HttpResponse.json(
        { success: false, message: 'Horse not found', status: 'fail' },
        { status: 404 }
      )
    ),
    http.get(`${base}/api/v1/horses/:id/visit`, () =>
      HttpResponse.json(visitBody, { status: visitStatus })
    )
  );
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider userOverrides={{ money: 5000 }}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/horses/:id" element={<HorseDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('the horse page in visitor mode', () => {
  it("another player's stallion: public facts, revealed traits by name, the plaque and the Breed button", async () => {
    serve({ success: true, data: visit });
    renderAt('/horses/99');

    expect(await screen.findByRole('heading', { name: 'Moonrise Sonata' })).toBeInTheDocument();
    expect(screen.getByText('Visiting')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Standing at stud/ })).toBeInTheDocument();
    expect(screen.getByText('Private Stud')).toBeInTheDocument();
    expect(screen.getByText('Moonrise Sonata stands with Alder Hollow.')).toBeInTheDocument();
    expect(screen.getByText('Even Tempered')).toBeInTheDocument();
    expect(screen.queryByText(/evenTempered/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Midnight Ledger' })).toHaveAttribute(
      'href',
      '/horses/50'
    );
    expect(screen.getByRole('button', { name: 'Breed to Moonrise Sonata (500)' })).toBeEnabled();
    // Read-only: none of the owner's controls.
    expect(screen.queryByRole('button', { name: /Train This Horse/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Stud standing' })).not.toBeInTheDocument();
  });

  it('a mare not at stud shows no plaque and no Breed button', async () => {
    serve({ success: true, data: { ...visit, name: 'Wren', sex: 'Mare', stud: null } });
    renderAt('/horses/77');

    expect(await screen.findByRole('heading', { name: 'Wren' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Standing at stud/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Breed to/ })).not.toBeInTheDocument();
  });

  it('arriving from a breeding request, the stallion owner can accept or reject on the mare', async () => {
    serve({ success: true, data: { ...visit, id: 77, name: 'Wren', sex: 'Mare', stud: null } });
    server.use(
      http.get(`${base}/api/v1/studs/requests`, () =>
        HttpResponse.json({
          success: true,
          data: {
            requests: [
              {
                id: 41,
                status: 'PENDING',
                fee: 500,
                createdAt: new Date().toISOString(),
                resolvedAt: null,
                declineReason: null,
                sire: { id: 5, name: 'Thunder Orchard' },
                dam: { id: 77, name: 'Wren' },
                counterparty: { username: 'Maple Run' },
              },
            ],
          },
        })
      )
    );
    renderAt('/horses/77?request=41');

    expect(await screen.findByRole('button', { name: 'Accept Wren (500)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(
      screen.getByText('Maple Run asks to breed Wren to Thunder Orchard for 500.')
    ).toBeInTheDocument();
  });

  it('a horse that does not exist is still "Horse Not Found"', async () => {
    serve({ success: false, message: 'Horse not found', status: 'fail' }, 404);
    renderAt('/horses/12345');

    expect(await screen.findByText('Horse Not Found')).toBeInTheDocument();
  });
});
