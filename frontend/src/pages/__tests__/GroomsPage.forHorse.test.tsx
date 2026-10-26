/**
 * GroomsPage keeps the horse it came from (Equoria-e861f; owner ruling q67).
 *
 * "Assign Groom" on a horse's page and the Care area's "Assign a groom" link
 * both send ?horseId=. The page used to ignore it, so the player arrived with
 * her horse forgotten. Now the assign dialog opens for that horse.
 *
 * Real GroomsPage, MyGroomsDashboard and hooks; MSW serves the default groom
 * roster (one hired groom) and horse list (Storm Runner #1, Midnight Dream #2).
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import GroomsPage from '../GroomsPage';
import { MockAuthProvider } from '@/test/utils';

function renderAt(path: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <GroomsPage />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('GroomsPage ?horseId= (Equoria-e861f)', () => {
  it('opens the assign dialog for the horse the player came from', async () => {
    renderAt('/grooms?horseId=2');
    const dialog = await screen.findByTestId('assign-groom-modal');
    expect(within(dialog).getByText('Midnight Dream')).toBeInTheDocument();
  });

  it('opens nothing for a horse that is not hers', async () => {
    renderAt('/grooms?horseId=999');
    await screen.findByTestId('groom-grid');
    expect(screen.queryByTestId('assign-groom-modal')).not.toBeInTheDocument();
  });
});
