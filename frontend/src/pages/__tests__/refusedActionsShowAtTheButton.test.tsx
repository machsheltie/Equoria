/**
 * A refused listing, delisting, purchase, profile save or craft says why next
 * to the button that failed, in plain words (owner ruling 2026-10-28, q161,
 * Equoria-bvddn.40). Old behaviour: the hooks popped a toast carrying the
 * server's own message verbatim ("Horse state changed (already sold or
 * delisted)", "Insufficient coins (need 10)"), and the pages showed nothing at
 * the control itself.
 *
 * Real pages, real hooks, real apiClient; MSW stands in for the HTTP boundary
 * only, answering with the backend's real refusal bodies.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { AuthProvider } from '@/contexts/AuthContext';
import ListForSaleModal from '../horse-detail/ListForSaleModal';
import HorseActionBar from '../horse-detail/HorseActionBar';
import type { Horse } from '../horse-detail/HorseDetailPageTypes';
import { ListingDetailDialog } from '@/components/marketplace/ListingDetailDialog';
import HorseMarketplacePage from '../HorseMarketplacePage';
import CraftingPage from '../CraftingPage';
import SettingsPage from '../SettingsPage';
import ProfilePage from '../ProfilePage';
import FeedShopPage from '../FeedShopPage';
import InventoryPage from '../InventoryPage';
import { MockAuthProvider } from '@/test/utils';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const refusal = (message: string, status: number) =>
  HttpResponse.json({ success: false, message }, { status });

function client() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return qc;
}

function renderWith(ui: React.ReactElement, qc = client()) {
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

const player = {
  id: 7,
  username: 'MoonRider',
  email: 'moonrider@equoria.local',
  role: 'user',
  money: 50_000,
  level: 3,
  xp: 0,
  bio: '',
  stableName: null,
  welcomeSeen: true,
  completedOnboarding: true,
  onboardingStep: 10,
  preferences: { reducedMotion: false, highContrast: false, compactCards: false },
};

function stubProfile() {
  server.use(
    http.get(`${base}/api/v1/auth/profile`, () =>
      HttpResponse.json({ status: 'success', data: { user: player } })
    )
  );
}

describe('Refused actions show their reason at the button (Equoria-bvddn.40)', () => {
  it('a refused listing names the price rule at the Confirm button, not the server text', async () => {
    server.use(
      http.post(`${base}/api/v1/marketplace/list`, () =>
        refusal('Horse is already listed for sale', 400)
      )
    );
    const user = userEvent.setup();
    renderWith(
      <ListForSaleModal
        isOpen
        onClose={() => {}}
        horseId={11}
        horseName="Stardust"
        onSuccess={() => {}}
      />
    );

    await user.type(screen.getByRole('spinbutton'), '5000');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    const modal = screen.getByTestId('list-for-sale-modal');
    expect(await within(modal).findByRole('alert')).toHaveTextContent(
      "That horse couldn't be listed. Set a price from 100 to 9,999,999 coins, and check it isn't already for sale."
    );
    expect(screen.queryByText(/already listed for sale/i)).not.toBeInTheDocument();
  });

  it('a refused purchase says why inside the listing dialog', async () => {
    server.use(
      http.post(`${base}/api/v1/marketplace/buy/:id`, () => refusal('Insufficient funds', 400))
    );
    const user = userEvent.setup();
    renderWith(
      <ListingDetailDialog
        listing={
          {
            id: 21,
            horseId: 21,
            name: 'Nimbus',
            breed: 'Arabian',
            age: 5,
            sex: 'Mare',
            salePrice: 1_000,
            seller: 'Someone',
            imageUrl: null,
            stats: {},
          } as unknown as React.ComponentProps<typeof ListingDetailDialog>['listing']
        }
        userBalance={5_000}
        onClose={() => {}}
        onPurchased={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /buy now/i }));

    const dialog = screen.getByTestId('listing-detail-dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "That horse couldn't be bought. Your coins may not cover the price, or it's no longer for sale."
    );
    expect(screen.queryByText('Insufficient funds')).not.toBeInTheDocument();
  });

  it('a refused delist on My Listings shows on that listing only', async () => {
    stubProfile();
    const listing = (id: number, name: string) => ({
      id,
      horseId: id,
      name,
      breed: 'Arabian',
      age: 5,
      sex: 'Mare',
      salePrice: 25_000,
      imageUrl: null,
    });
    server.use(
      http.get(`${base}/api/v1/marketplace/search`, () =>
        HttpResponse.json({
          success: true,
          data: { horses: [], pagination: { page: 1, totalPages: 1, total: 0 } },
        })
      ),
      http.get(`${base}/api/v1/marketplace/my-listings`, () =>
        HttpResponse.json({ success: true, data: [listing(31, 'Stardust'), listing(32, 'Nimbus')] })
      ),
      http.delete(`${base}/api/v1/marketplace/list/:horseId`, () =>
        refusal('Horse state changed (already sold or delisted)', 409)
      )
    );
    const user = userEvent.setup();
    renderWith(<HorseMarketplacePage />);

    await user.click(await screen.findByTestId('tab-my-listings'));
    const [first] = await screen.findAllByRole('button', { name: /delist/i });
    await user.click(first);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'That listing changed. The horse may already be sold or off the Marketplace.'
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/horse state changed/i)).not.toBeInTheDocument();
  });

  it('a refused delist from the horse page Quick Actions shows beside the Delist button', async () => {
    server.use(
      http.delete(`${base}/api/v1/marketplace/list/:horseId`, () =>
        refusal('Horse is not listed for sale', 400)
      )
    );
    const user = userEvent.setup();
    const horse = {
      id: 41,
      name: 'TestFixture-DelistHorse',
      forSale: true,
      lastFedDate: null,
      equippedFeedType: 'oats',
      feedHealth: 'good',
    } as unknown as Horse;
    renderWith(
      <HorseActionBar
        horse={horse}
        onAssignRider={() => {}}
        onListForSale={() => {}}
        refetch={() => {}}
      />
    );

    await user.click(screen.getByTestId('action-delist'));

    const bar = screen.getByTestId('horse-action-bar');
    expect(await within(bar).findByRole('alert')).toHaveTextContent(
      "That horse isn't listed for sale any more."
    );
    expect(screen.queryByText('Horse is not listed for sale')).not.toBeInTheDocument();
  });

  it('a refused craft shows on the recipe that failed', async () => {
    const recipe = (id: string, name: string) => ({
      id,
      name,
      description: `${name} description`,
      tier: 0,
      cost: 10,
      materials: { leather: 0, cloth: 0, dye: 0, metal: 0, thread: 0 },
      result: id,
      resultName: name,
      resultCategory: 'tack',
      bonus: '+1',
      isCosmetic: false,
      locked: false,
      affordable: true,
    });
    server.use(
      http.get(`${base}/api/v1/crafting/materials`, () =>
        HttpResponse.json({
          success: true,
          data: {
            workshopTier: 0,
            materials: { leather: 5, cloth: 5, dye: 5, metal: 5, thread: 5 },
          },
        })
      ),
      http.get(`${base}/api/v1/crafting/recipes`, () =>
        HttpResponse.json({
          success: true,
          data: {
            workshopTier: 0,
            recipes: [recipe('bridle', 'Bridle'), recipe('saddle', 'Saddle')],
          },
        })
      ),
      http.post(`${base}/api/v1/crafting/craft`, () => refusal('Insufficient coins (need 10)', 400))
    );
    const user = userEvent.setup();
    renderWith(<CraftingPage />);

    const [first] = await screen.findAllByRole('button', { name: 'Craft' });
    await user.click(first);
    await user.click(await screen.findByRole('button', { name: 'Confirm Craft' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("You don't have the coins or materials this recipe needs.");
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByText('Bridle').closest('div.p-4')).toContainElement(alert);
    expect(screen.queryByText(/insufficient coins/i)).not.toBeInTheDocument();
  });

  it('a refused username change in Settings shows at Save Changes in plain words', async () => {
    stubProfile();
    server.use(
      http.put(`${base}/api/v1/auth/profile`, () =>
        refusal('User with this username already exists', 409)
      )
    );
    const qc = client();
    qc.setQueryData(['profile'], { user: player });
    qc.setQueryData(['verificationStatus'], {
      verified: true,
      email: player.email,
      verifiedAt: null,
    });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/settings']}>
            <SettingsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const field = await screen.findByLabelText('Username');
    await user.clear(field);
    await user.type(field, 'TakenName');
    await user.click(screen.getByTestId('settings-save-account'));

    const account = screen.getByTestId('settings-account');
    const message = await within(account).findByText(
      'That username is already taken. Choose a different one.'
    );
    expect(message.closest('[role="alert"]')).not.toBeNull();
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
  });

  it('a refused profile save names the taken username at the form', async () => {
    stubProfile();
    server.use(
      http.put(`${base}/api/v1/auth/profile`, () =>
        refusal('User with this username already exists', 409)
      ),
      http.get(`${base}/api/v1/users/:id/activity`, () =>
        HttpResponse.json({ success: true, data: [] })
      )
    );
    const user = userEvent.setup();
    renderWith(<ProfilePage />);

    const field = await screen.findByLabelText('Stable Name');
    await user.type(field, 'Starlight Farm');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText(
        'Your profile was not saved. That username is already taken. Choose a different one.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
  });
});

/**
 * The same ruling for the feed shop, feeding, unequipping and two Settings
 * saves (Equoria-c1sg6). Old behaviour: each page toasted the server's message
 * ("packs must be an integer ≥ 1", "Unknown feed tier: elite", "Item is not
 * currently equipped", "Current password is incorrect", "Preference
 * 'compactCards' must be a boolean") and showed nothing at the control.
 */
describe('Refused feed, inventory and Settings actions show at the control (Equoria-c1sg6)', () => {
  it('a refused feed purchase shows under that tier only', async () => {
    const tier = (id: string, name: string) => ({
      id,
      name,
      description: `${name}.`,
      packPrice: 100,
      perUnit: 1,
      statRollPct: 5,
      pregnancyBonusPct: 2,
    });
    server.use(
      http.get('*/api/v1/feed-shop/catalog', () =>
        HttpResponse.json([tier('basic', 'Basic Feed'), tier('elite', 'Elite Feed')])
      ),
      http.post('*/api/v1/feed-shop/purchase', () =>
        refusal('Insufficient funds. 1 pack(s) of Basic Feed cost 100 coins.', 400)
      )
    );
    const user = userEvent.setup();
    renderWith(<FeedShopPage />);

    await user.click(await screen.findByTestId('buy-basic'));

    const card = screen.getByTestId('feed-tier-basic');
    expect(await within(card).findByRole('alert')).toHaveTextContent(
      "That feed couldn't be bought. Your coins may not cover it."
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/insufficient funds/i)).not.toBeInTheDocument();
  });

  it('a refused feeding shows beside the Feed button in plain words', async () => {
    server.use(
      http.post(`${base}/api/v1/horses/:id/feed`, () => refusal('Unknown feed tier: elite', 400))
    );
    const user = userEvent.setup();
    const horse = {
      id: 51,
      name: 'TestFixture-FeedHorse',
      forSale: false,
      lastFedDate: null,
      equippedFeedType: 'elite',
      feedHealth: 'good',
    } as unknown as Horse;
    renderWith(
      <HorseActionBar
        horse={horse}
        onAssignRider={() => {}}
        onListForSale={() => {}}
        refetch={() => {}}
      />
    );

    await user.click(screen.getByTestId('action-feed'));

    const bar = screen.getByTestId('horse-action-bar');
    expect(await within(bar).findByRole('alert')).toHaveTextContent(
      "That horse couldn't be fed. It may already have been fed today, or its feed may have run out. Equip or buy more feed and try again."
    );
    expect(screen.queryByText(/unknown feed tier/i)).not.toBeInTheDocument();
  });

  it('a refused unequip shows on that item', async () => {
    server.use(
      http.get(`${base}/api/v1/inventory`, () =>
        HttpResponse.json({
          success: true,
          message: 'ok',
          data: {
            items: [
              {
                id: 'inv-1',
                itemId: 'all-purpose-saddle',
                category: 'saddle',
                name: 'All Purpose Saddle',
                bonus: '+2',
                quantity: 1,
                equippedToHorseId: 7,
                equippedToHorseName: 'Moonflower',
              },
            ],
            total: 1,
          },
        })
      ),
      http.get(`${base}/api/v1/feed-shop/catalog`, () =>
        HttpResponse.json({ success: true, message: 'ok', data: [] })
      ),
      http.post(`${base}/api/v1/inventory/unequip`, () =>
        refusal('Item is not currently equipped', 400)
      )
    );
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={client()}>
        <MockAuthProvider>
          <MemoryRouter>
            <InventoryPage />
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole('button', { name: /unequip/i }));

    const card = screen.getByTestId('inventory-item-inv-1');
    expect(await within(card).findByRole('alert')).toHaveTextContent(
      "That item isn't on a horse any more."
    );
    expect(screen.queryByText('Item is not currently equipped')).not.toBeInTheDocument();
  });

  function renderSettingsWith(qc: QueryClient) {
    qc.setQueryData(['profile'], { user: player });
    qc.setQueryData(['verificationStatus'], {
      verified: true,
      email: player.email,
      verifiedAt: null,
    });
    return render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/settings']}>
            <SettingsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  it('a wrong current password is named at the password form, not as an ended session', async () => {
    stubProfile();
    server.use(
      http.post(`${base}/api/v1/auth/change-password`, () =>
        refusal('Current password is incorrect', 401)
      )
    );
    const user = userEvent.setup();
    renderSettingsWith(client());

    await user.click(await screen.findByTestId('settings-show-password-form'));
    await user.type(screen.getByLabelText('Current Password'), 'NotMyPassword1!');
    await user.type(screen.getByLabelText(/New Password \(min 12/), 'BrandNewPassword9!');
    await user.type(screen.getByLabelText('Confirm New Password'), 'BrandNewPassword9!');
    await user.click(screen.getByTestId('settings-submit-password'));

    const form = screen.getByTestId('settings-password-form');
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      "Your current password isn't right. Check it and try again."
    );
    expect(screen.queryByText(/current password is incorrect/i)).not.toBeInTheDocument();
  });

  it('a refused display switch save shows beside that switch', async () => {
    stubProfile();
    server.use(
      http.patch(`${base}/api/v1/auth/profile/preferences`, () =>
        refusal("Preference 'compactCards' must be a boolean", 400)
      )
    );
    const user = userEvent.setup();
    renderSettingsWith(client());

    await user.click(await screen.findByTestId('settings-nav-display'));
    await user.click(within(screen.getByTestId('display-compact-cards')).getByRole('switch'));

    const section = screen.getByTestId('settings-display');
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      "That setting couldn't be saved. Reload Settings and try again."
    );
    expect(within(section).getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText(/must be a boolean/i)).not.toBeInTheDocument();
  });
});
