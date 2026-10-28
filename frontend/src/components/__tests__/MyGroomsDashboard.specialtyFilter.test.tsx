/**
 * MyGroomsDashboard's specialty filter offers exactly the backend's groom
 * specialties (Equoria-5xvl7). It compared `groom.specialty` against
 * `generalCare` and `showHandling`, values the backend never stores, so those
 * options could never match and `general` and `medical` grooms had no option.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, test, expect } from 'vitest';
import { BrowserRouter } from '../../test/utils';
import MyGroomsDashboard from '../MyGroomsDashboard';

const backendSchema = readFileSync(
  join(__dirname, '../../../../backend/constants/schema.mjs'),
  'utf8'
);
const block = /export const GROOM_SPECIALTIES = \{([\s\S]*?)\};/.exec(backendSchema);
const backendSpecialties = [...(block?.[1] ?? '').matchAll(/:\s*'(\w+)'/g)].map((m) => m[1]);

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

const groomFor = (specialty: string, index: number) => ({
  id: index + 1,
  name: `Groom${index} Fixture`,
  specialty,
  skillLevel: 'expert',
  personality: 'gentle',
  experience: 5,
  ageYears: 30,
  sessionRate: 100,
  bio: 'Fixture groom',
  isActive: true,
  availableSlots: 1,
  currentAssignments: 0,
  maxAssignments: 4,
  userId: 1,
});

const grooms = backendSpecialties.map(groomFor);
const salary = {
  totalWeeklyCost: 0,
  groomCount: grooms.length,
  maxHorsesPerGroom: 10,
  breakdown: [],
};

const renderDashboard = () =>
  render(
    <MyGroomsDashboard
      userId={1}
      groomsData={grooms as never}
      assignmentsData={[]}
      salaryCostsData={salary as never}
    />,
    { wrapper: Wrapper }
  );

describe('MyGroomsDashboard specialty filter', () => {
  test('reads the backend specialty list', () => {
    expect(backendSpecialties.length).toBeGreaterThan(0);
  });

  test('offers exactly the backend specialties', () => {
    renderDashboard();
    const select = screen.getByLabelText(/filter by specialty/i) as HTMLSelectElement;
    const offered = [...select.options].map((o) => o.value).filter((v) => v !== 'all');
    expect(offered.sort()).toEqual([...backendSpecialties].sort());
  });

  test.each(backendSpecialties.map((s, i) => [s, i] as const))(
    'choosing %s shows only that specialty',
    (specialty, index) => {
      renderDashboard();
      fireEvent.change(screen.getByLabelText(/filter by specialty/i), {
        target: { value: specialty },
      });
      expect(screen.getByText(`Groom${index} Fixture`)).toBeInTheDocument();
      expect(screen.getAllByText(/Groom\d+ Fixture/)).toHaveLength(1);
    }
  );
});
