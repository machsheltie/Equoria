/**
 * Missing numbers are not zeros (Equoria-qqhwh)
 *
 * Display-path `?? 0` fallbacks rendered an ABSENT value as a real zero:
 *   - a listed horse without a price read "For Sale — 0 coins"
 *     (HorseProfileCard) / "Listed for 0 coins" and "Fee: 0 coins"
 *     (StudSaleTab);
 *   - a hub horse card showed an absent stat identically to a real zero stat.
 * Doctrine §4: unknown is "—" or omitted; legitimate zeroes stay zero.
 *
 * Real components + real providers; MSW only at the HTTP boundary.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import HorseProfileCard from '../horse-detail/HorseProfileCard';
import StudSaleTab from '../horse-detail/StudSaleTab';
import Index from '../Index';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const baseHorse = {
  id: 1,
  name: 'Moonflower',
  breed: 'Thoroughbred',
  age: 6,
  gender: 'Mare',
  healthStatus: 'Excellent',
  stats: { speed: 40, stamina: 40, agility: 40 },
};

type CardHorse = React.ComponentProps<typeof HorseProfileCard>['horse'];
type TabHorse = React.ComponentProps<typeof StudSaleTab>['horse'];

function renderCard(extra: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HorseProfileCard
          horse={{ ...baseHorse, ...extra } as unknown as CardHorse}
          sireName={null}
          isEditing={false}
          editName=""
          onStartEdit={() => {}}
          onCancelEdit={() => {}}
          onChangeEditName={() => {}}
          refetch={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function renderTab(extra: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MockAuthProvider>
        <MemoryRouter>
          <StudSaleTab
            horse={{ ...baseHorse, ...extra } as unknown as TabHorse}
            onListForSale={() => {}}
            onDelist={() => {}}
            isDelisting={false}
          />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('HorseProfileCard sale badge (Equoria-qqhwh)', () => {
  it('does not claim "0 coins" when a listed horse has no price', () => {
    renderCard({ forSale: true });
    expect(screen.getByText(/for sale/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 coins/i)).not.toBeInTheDocument();
  });

  it('shows the real price when there is one', () => {
    renderCard({ forSale: true, salePrice: 12500 });
    expect(screen.getByText(/For Sale — 12,500 coins/)).toBeInTheDocument();
  });
});

describe('StudSaleTab status (Equoria-qqhwh)', () => {
  it('does not claim "0 coins" when a listed horse has no price', () => {
    renderTab({ forSale: true });
    expect(screen.queryByText(/listed for 0 coins/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Listed for sale$/i)).toBeInTheDocument();
  });

  it('shows the real sale price', () => {
    renderTab({ forSale: true, salePrice: 9000 });
    expect(screen.getByText('Listed for 9,000 coins')).toBeInTheDocument();
  });

  // Owner ruling q93 (2026-10-26, Equoria-q4uem.9): a stallion's standing is one
  // three-way choice with the fee beside it. Old contract: an "At stud · Fee"
  // status line. The honesty rule is unchanged: unknown is not 0, 0 stays 0.
  it('shows an unknown stud fee as an empty fee, not 0', () => {
    renderTab({ gender: 'Stallion', ageYears: 6, studStatus: 'At Public Stud' });
    expect(screen.getByLabelText('Stud fee')).toHaveValue(null);
  });

  it('keeps a genuine stud fee of 0 as 0', () => {
    renderTab({ gender: 'Stallion', ageYears: 6, studStatus: 'At Public Stud', studFee: 0 });
    expect(screen.getByLabelText('Stud fee')).toHaveValue(0);
  });
});

describe('Hub horse card stats (Equoria-qqhwh)', () => {
  it('shows an absent stat as "—" and keeps a real 0 as 0', async () => {
    server.use(
      http.get(`${base}/api/v1/horses`, () =>
        HttpResponse.json({
          success: true,
          data: [
            {
              id: 11,
              name: 'Statline',
              breed: 'Thoroughbred',
              sex: 'Mare',
              age: 6,
              ageYears: 6,
              // Only speed is present, and it is a genuine zero.
              stats: { speed: 0 },
            },
          ],
        })
      )
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MockAuthProvider userOverrides={{ completedOnboarding: false }}>
          <MemoryRouter>
            <Index />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    const card = await screen.findByTestId('dashboard-horse-card-11');
    const valueOf = (label: string) =>
      within(card).getByText(label).nextElementSibling as HTMLElement;
    expect(valueOf('SPD')).toHaveTextContent(/^0$/);
    expect(valueOf('PRC')).toHaveTextContent('—');
    expect(valueOf('FCS')).toHaveTextContent('—');
  });
});
