/**
 * HorseActionBar — opaque background contract (Equoria-o5hub.28).
 *
 * The fixed bottom quick-actions bar overlays page content (including the
 * gold Train / Enter Competition CTAs at initial scroll position). A
 * translucent background made the bar's labels unreadable over bright
 * content, so the bar must be FULLY opaque: no opacity-modified background
 * and no backdrop blur (blur on an opaque surface is dead weight and a
 * D-06 violation).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HorseActionBar from '../HorseActionBar';
import type { Horse } from '../HorseDetailPageTypes';

const horse = {
  id: 1,
  name: 'TestFixture-OpacityHorse',
  forSale: false,
  lastFedDate: null,
  equippedFeedType: 'oats',
  feedHealth: 'good',
} as unknown as Horse;

function renderBar() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <HorseActionBar
          horse={horse}
          onAssignRider={() => {}}
          onListForSale={() => {}}
          refetch={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HorseActionBar opaque background (Equoria-o5hub.28)', () => {
  it('uses the fully opaque deep-space background token', () => {
    renderBar();
    const bar = screen.getByTestId('horse-action-bar');
    expect(bar.className).toContain('bg-[var(--bg-deep-space)]');
  });

  it('has NO opacity-modified background (the /NN suffix made it translucent)', () => {
    renderBar();
    const bar = screen.getByTestId('horse-action-bar');
    expect(bar.className).not.toMatch(/bg-\[var\(--bg-deep-space\)\]\/\d+/);
  });

  it('has NO backdrop blur (opaque surfaces must not blur — D-06)', () => {
    renderBar();
    const bar = screen.getByTestId('horse-action-bar');
    expect(bar.className).not.toContain('backdrop-blur');
  });
});
