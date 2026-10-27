/**
 * Marketplace all-horses search (Equoria-q4uem.9.1, owner ruling 2026-10-27 q104).
 *
 * The Browse tab searches all horses: the player ticks For sale and/or At stud,
 * narrows by age, breed, sex, color, sale price, stud fee and Public/Private
 * stud, and sorts by price. MSW captures the real request URLs through the real
 * fetch pipeline; the server side is covered by
 * backend/modules/marketplace/__tests__/horseSearch.integration.test.mjs.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import HorseMarketplacePage from '../HorseMarketplacePage';
import React from 'react';

const captured: URLSearchParams[] = [];

const stats = {
  speed: 50,
  stamina: 50,
  agility: 50,
  precision: 50,
  strength: 50,
  intelligence: 50,
  boldness: 50,
};

const BOTH = {
  id: 31,
  name: 'TestFixture-q4uem91-both',
  breed: 'Thoroughbred',
  age: 6,
  sex: 'Stallion',
  color: 'Dark Bay',
  owner: { username: 'TestFixture-keeper' },
  imageUrl: null,
  stats,
  revealedTraits: { positive: ['trustBuilding'], negative: ['skittishAtGates'] },
  sale: { price: 9000 },
  stud: { mode: 'private', fee: 450 },
};

function handlers() {
  return [
    http.get('*/api/v1/auth/profile', () =>
      HttpResponse.json({
        status: 'success',
        data: { user: { id: 1, username: 't', email: 't@e.com', role: 'user', money: 100000 } },
      })
    ),
    http.get('*/api/v1/breeds', () =>
      HttpResponse.json({
        success: true,
        data: [{ id: 7, name: 'TestFixture-Arabian', description: null }],
        count: 1,
      })
    ),
    http.get('*/api/v1/marketplace/search', ({ request }) => {
      captured.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        success: true,
        data: { horses: [BOTH], pagination: { page: 1, totalPages: 1, total: 1 } },
      });
    }),
  ];
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HorseMarketplacePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const last = () => captured[captured.length - 1];

describe('Marketplace all-horses search (Equoria-q4uem.9.1)', () => {
  beforeEach(() => {
    captured.length = 0;
    server.use(...handlers());
  });

  it('starts with For sale and At stud both ticked', async () => {
    renderPage();
    await waitFor(() => expect(last()).toBeDefined());
    expect(last().get('forSale')).toBe('true');
    expect(last().get('atStud')).toBe('true');
    expect(screen.getByRole('checkbox', { name: /horses for sale/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /stallions at stud/i })).toBeChecked();
  });

  it('unticking a box narrows the search; unticking both asks for a tick and sends nothing', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('TestFixture-q4uem91-both');

    await user.click(screen.getByRole('checkbox', { name: /stallions at stud/i }));
    await waitFor(() => {
      expect(last().get('atStud')).toBe('false');
      expect(last().get('forSale')).toBe('true');
    });

    const before = captured.length;
    await user.click(screen.getByRole('checkbox', { name: /horses for sale/i }));
    expect(await screen.findByText(/tick for sale, at stud, or both/i)).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 100));
    expect(captured.length).toBe(before);
  });

  it('stud, price, color and sort filters reach the server', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /advanced filters/i }));

    await user.selectOptions(screen.getByLabelText(/^stud$/i), 'private');
    await user.type(screen.getByLabelText(/min stud fee/i), '100');
    await user.type(screen.getByLabelText(/max sale price/i), '5000');
    await user.type(screen.getByLabelText(/^color$/i), 'bay');
    await user.selectOptions(screen.getByLabelText(/sort listings/i), 'priceDesc');

    await waitFor(() => {
      const p = last();
      expect(p.get('studMode')).toBe('private');
      expect(p.get('minStudFee')).toBe('100');
      expect(p.get('maxPrice')).toBe('5000');
      expect(p.get('color')).toBe('bay');
      expect(p.get('sort')).toBe('priceDesc');
    });
  });

  it('a row shows both terms, revealed traits as words, and the name opens the horse page', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: 'TestFixture-q4uem91-both' });
    expect(link).toHaveAttribute('href', '/horses/31');

    expect(screen.getByTestId('stud-terms')).toHaveTextContent(/private stud/i);
    expect(screen.getByTestId('stud-terms')).toHaveTextContent('450');
    expect(screen.getByTestId('sale-terms')).toHaveTextContent('9,000');
    expect(screen.getByText(/trust building/i)).toBeInTheDocument();
    expect(screen.getByText(/skittish at gates/i)).toBeInTheDocument();
    // No stored code name reaches the player.
    expect(screen.queryByText(/trustBuilding/)).not.toBeInTheDocument();
  });

  it('Buy on a horse for sale opens the purchase dialog', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole('button', { name: /^buy testfixture-q4uem91-both$/i })
    );
    expect(await screen.findByRole('button', { name: /buy now/i })).toBeInTheDocument();
  });
});
