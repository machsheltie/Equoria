/**
 * Another player's horse opens the SAME horse page, read-only (owner ruling
 * q205; owner, 2026-10-28: "It has ZERO reason to have that archway cutout in
 * place of a horse's normal image. It should still be formatted like the
 * original horse page. And it still needs all of the normal sections that a
 * player should be allowed to view.").
 *
 * Old contract, replaced by that ruling: a separate visitor composition with an
 * arch-shaped portrait (HorseVisitorView, e017dfe61). Now: the owner page's
 * profile card with the horse's normal image, and the tabs Overview,
 * Disciplines, Genetics, Conformation, Gaits, Show Results, Pedigree and
 * Stud / Sale, all fed by GET /horses/:id/visit. No owner controls; the
 * visitor's own actions (breed to a stallion at stud, answer a request, buy a
 * listed horse) sit in Stud / Sale. Never a hidden trait name or the genotype.
 *
 * The real HorseDetailPage at /horses/:id: the owner-only read answers 404 for
 * another player's horse. MSW at the HTTP boundary only.
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  breedId: 4,
  sex: 'Stallion',
  age: 7,
  colorName: 'Black',
  shade: 'dark',
  imageUrl: null,
  stats: {
    precision: 70,
    strength: 77,
    speed: 74,
    agility: 69,
    endurance: 60,
    intelligence: 77,
    stamina: 81,
    balance: 65,
    boldness: 62,
    flexibility: 58,
    obedience: 66,
    focus: 71,
  },
  temperament: 'Willing',
  dateOfBirth: '2026-09-01T00:00:00.000Z',
  revealedTraits: { positive: ['evenTempered'], negative: [] },
  traitDiscovery: {
    positive: [
      { key: 'evenTempered', label: 'Even Tempered', type: 'positive', description: null },
    ],
    negative: [],
    dormant: [{ key: 'fearful', label: 'Fearful', type: 'negative', description: null }],
    hiddenCount: 2,
  },
  showRecord: { wins: 2, secondPlaces: 1, thirdPlaces: 1, winnings: 1300, points: 2350 },
  careTeam: {
    trainer: { name: 'Alice Thornton', starLevel: 'advanced' },
    groom: null,
    rider: null,
  },
  displayedHealth: 'Good',
  feedHealth: 'Good',
  bondScore: 40,
  disciplineScores: { Dressage: 12 },
  conformation: { head: 70, neck: 72, overallConformation: 66 },
  gaitScores: { walk: 60, trot: 62, canter: 64, gallop: 66, gaiting: null },
  currentTitle: null,
  titlePoints: 0,
  breedingValueBoost: 0,
  offspring: [{ id: 120, name: 'Little Sonata' }],
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

async function openTab(name: string) {
  await userEvent.click(screen.getByRole('tab', { name }));
}

describe('the horse page in visitor mode is the owner page, read-only', () => {
  it('has the normal profile card and image, the visitor tabs only, and no owner controls', async () => {
    serve({ success: true, data: visit });
    renderAt('/horses/99');

    expect(await screen.findByRole('heading', { name: 'Moonrise Sonata' })).toBeInTheDocument();
    // The normal horse image in the normal place, not the arch cutout.
    expect(screen.getByRole('img', { name: 'Moonrise Sonata' })).toBeInTheDocument();
    expect(document.querySelector('.stud-visit__portrait')).toBeNull();
    expect(screen.getByTestId('record-placings')).toHaveTextContent('2/1/1');
    expect(screen.getByTestId('horse-owner-line')).toHaveTextContent('Owned by Alder Hollow');

    const tabNames = screen.getAllByRole('tab').map((tab) => tab.textContent?.trim());
    expect(tabNames).toEqual([
      'Overview',
      'Disciplines',
      'Genetics',
      'Conformation',
      'Gaits',
      'Show Results',
      'Pedigree',
      'Stud / Sale',
    ]);

    expect(screen.queryByRole('button', { name: /Train This Horse/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enter Competition/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit horse name/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Groom/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Assign/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Parents' })).toBeInTheDocument();
  });

  it('Overview reads the horse details and care team from the visit', async () => {
    serve({ success: true, data: visit });
    renderAt('/horses/99');

    expect(await screen.findByTestId('horse-detail-color')).toHaveTextContent(/^Black — Dark$/);
    expect(screen.getByTestId('horse-detail-breed')).toHaveTextContent('Friesian');
    expect(screen.getByTestId('horse-temperament-value')).toHaveTextContent('Willing');
    expect(screen.getByTestId('care-team-trainer')).toHaveTextContent('Alice Thornton');
    expect(screen.getByTestId('care-team-groom')).toHaveTextContent('No groom assigned.');
  });

  it('Genetics shows trait chips with hidden traits as a count, and no colour genotype', async () => {
    serve({ success: true, data: visit });
    renderAt('/horses/99');
    await screen.findByRole('heading', { name: 'Moonrise Sonata' });
    await openTab('Genetics');

    expect(await screen.findByRole('button', { name: 'Even Tempered' })).toBeInTheDocument();
    expect(screen.getAllByTestId('trait-chip-hidden')).toHaveLength(2);
    expect(screen.getByTestId('trait-chip-inactive')).toHaveTextContent('Fearful');
    expect(screen.queryByText(/Genetic Testing/i)).not.toBeInTheDocument();
  });

  it('Conformation, Gaits and Pedigree render from the visit', async () => {
    serve({ success: true, data: visit });
    renderAt('/horses/99');
    await screen.findByRole('heading', { name: 'Moonrise Sonata' });

    await openTab('Conformation');
    expect(await screen.findByTestId('conformation-tab')).toBeInTheDocument();
    expect(screen.getByTestId('conformation-score-card-head')).toHaveTextContent('70');

    await openTab('Gaits');
    expect(await screen.findByTestId('gait-walk-score')).toHaveTextContent('60');

    await openTab('Pedigree');
    expect(await screen.findByRole('link', { name: /Little Sonata/ })).toHaveAttribute(
      'href',
      '/horses/120'
    );
    expect(within(screen.getByTestId('pedigree-sire')).getByRole('link')).toHaveAttribute(
      'href',
      '/horses/50'
    );
  });

  it('Show Results pages through the visit ledger', async () => {
    serve({ success: true, data: visit });
    server.use(
      http.get(`${base}/api/v1/horses/:id/visit/show-results`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              showId: 7,
              showName: 'Halcyon Downs Classic',
              competitionType: { showType: 'ridden', discipline: 'Dressage' },
              status: 'completed',
              date: '2026-10-01T10:00:00.000Z',
              placement: 2,
              horsePointsAwarded: 30,
              winnings: 100,
              statGain: null,
              conformationAward: null,
            },
          ],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalRecords: 1,
            hasNextPage: false,
            hasPrevPage: false,
          },
        })
      )
    );
    renderAt('/horses/99');
    await screen.findByRole('heading', { name: 'Moonrise Sonata' });
    await openTab('Show Results');

    expect(await screen.findByText('Halcyon Downs Classic')).toBeInTheDocument();
  });

  it('Stud / Sale carries the stud plaque and Breed button, and no owner stud or sale controls', async () => {
    serve({ success: true, data: visit });
    renderAt('/horses/99');
    await screen.findByRole('heading', { name: 'Moonrise Sonata' });
    await openTab('Stud / Sale');

    expect(await screen.findByRole('heading', { name: /Standing at stud/ })).toBeInTheDocument();
    expect(screen.getByText('Private Stud')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Breed to Moonrise Sonata (500)' })).toBeEnabled();
    expect(screen.queryByRole('radiogroup', { name: 'Stud standing' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sale-listing-btn')).not.toBeInTheDocument();
  });

  it('a horse for sale carries a one-click Buy button with its price', async () => {
    serve({
      success: true,
      data: { ...visit, sex: 'Mare', stud: null, forSale: true, salePrice: 4200 },
    });
    renderAt('/horses/99');
    await screen.findByRole('heading', { name: 'Moonrise Sonata' });
    await openTab('Stud / Sale');

    expect(
      await screen.findByRole('button', { name: 'Buy Moonrise Sonata (4,200)' })
    ).toBeEnabled();
    expect(screen.queryByRole('heading', { name: /Standing at stud/ })).not.toBeInTheDocument();
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
    await screen.findByRole('heading', { name: 'Wren' });
    await openTab('Stud / Sale');

    expect(await screen.findByRole('button', { name: 'Accept Wren (500)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('a horse that does not exist is still "Horse Not Found"', async () => {
    serve({ success: false, message: 'Horse not found', status: 'fail' }, 404);
    renderAt('/horses/12345');

    expect(await screen.findByText('Horse Not Found')).toBeInTheDocument();
  });

  it("a visit that says the horse is the player's own never opens the read-only page", async () => {
    serve({ success: true, data: { ...visit, isOwn: true } });
    renderAt('/horses/99');

    expect(await screen.findByText('Error Loading Horse')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Moonrise Sonata' })).not.toBeInTheDocument();
  });
});
