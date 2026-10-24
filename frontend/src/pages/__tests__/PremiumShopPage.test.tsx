/**
 * PremiumShopPage — a World destination that only says "Coming soon"
 * (Equoria-rbo1c, owner ruling 2026-10-23). No payments, no items, no premium logic.
 * The World hub lists it like the other shop locations.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import React from 'react';
import PremiumShopPage from '../PremiumShopPage';
import WorldHubPage from '../WorldHubPage';

describe('PremiumShopPage', () => {
  it('uses the shop hero, links back to the World, and says Coming soon', () => {
    render(
      <MemoryRouter>
        <PremiumShopPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Premium Shop' })).toBeInTheDocument();
    expect(screen.getByTestId('page-hero-icon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'World' })).toHaveAttribute('href', '/world');
    expect(screen.getByTestId('premium-shop-coming-soon')).toHaveTextContent('Coming soon');
  });

  it('offers nothing to buy', () => {
    render(
      <MemoryRouter>
        <PremiumShopPage />
      </MemoryRouter>
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/buy|purchase|checkout|subscribe/i)).not.toBeInTheDocument();
  });
});

describe('WorldHubPage — Premium Shop destination', () => {
  it('lists the Premium Shop and links to it', () => {
    render(
      <MemoryRouter>
        <WorldHubPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('location-card-premium-shop')).toHaveAttribute(
      'href',
      '/premium-shop'
    );
  });
});
