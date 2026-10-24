/**
 * GroomList's specialty filter offers exactly the backend's groom specialties
 * (Equoria-x7gw6). The filter compared `groom.specialty` against `generalCare`
 * and `showHandling`, values the backend never stores, so those two options
 * could never match a groom and `general` and `medical` grooms had no option.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, test, expect } from 'vitest';
import { BrowserRouter } from '../../test/utils';
import { AuthProvider } from '../../contexts/AuthContext';
import GroomList from '../GroomList';

const backendSchema = readFileSync(
  join(__dirname, '../../../../backend/constants/schema.mjs'),
  'utf8'
);
const block = /export const GROOM_SPECIALTIES = \{([\s\S]*?)\};/.exec(backendSchema);
const backendSpecialties = [...(block?.[1] ?? '').matchAll(/:\s*'(\w+)'/g)].map((m) => m[1]);

const TestWrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider>
      <BrowserRouter>{children}</BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
);

const groomFor = (specialty: string, index: number) => ({
  marketplaceId: `groom-${index}`,
  firstName: `Groom${index}`,
  lastName: 'Fixture',
  specialty,
  skillLevel: 'expert',
  personality: 'gentle',
  experience: 5,
  sessionRate: 100,
  bio: 'Fixture groom',
  availability: true,
});

const marketplaceData = {
  grooms: backendSpecialties.map(groomFor),
  lastRefresh: new Date().toISOString(),
  nextFreeRefresh: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

describe('GroomList specialty filter', () => {
  test('reads the backend specialty list', () => {
    expect(backendSpecialties.length).toBeGreaterThan(0);
  });

  test('offers exactly the backend specialties', () => {
    render(
      <TestWrapper>
        <GroomList userId={1} marketplaceData={marketplaceData as never} />
      </TestWrapper>
    );
    const select = screen.getByTestId('specialty-filter') as HTMLSelectElement;
    const offered = [...select.options].map((o) => o.value).filter((v) => v !== 'all');
    expect(offered.sort()).toEqual([...backendSpecialties].sort());
  });

  test.each(backendSpecialties.map((s, i) => [s, i] as const))(
    'choosing %s shows only that specialty',
    async (specialty, index) => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={marketplaceData as never} />
        </TestWrapper>
      );
      fireEvent.change(screen.getByTestId('specialty-filter'), { target: { value: specialty } });
      await waitFor(() => {
        expect(screen.getByText(`Groom${index} Fixture`)).toBeInTheDocument();
        expect(screen.getAllByText(/Groom\d+ Fixture/)).toHaveLength(1);
      });
    }
  );
});
