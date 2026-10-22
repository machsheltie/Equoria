/**
 * AsidePanel balance — no fabricated zero (Equoria-bvddn.39)
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, MockAuthProvider } from '@/test/utils';
import { server } from '@/test/msw/server';
import { AsidePanel } from '../AsidePanel';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function renderAside(money: number | undefined) {
  server.use(
    http.get(`${base}/api/v1/horses`, () => HttpResponse.json({ success: true, data: [] }))
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider userOverrides={{ money }}>
        <MemoryRouter>
          <AsidePanel />
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>
  );
}

describe('AsidePanel balance (Equoria-bvddn.39)', () => {
  test('shows an unknown marker, not 0, when the profile has no balance', () => {
    renderAside(undefined);
    const value = screen.getByText('Balance').nextElementSibling as HTMLElement;
    expect(value).toHaveTextContent('—');
    expect(value.textContent).not.toMatch(/0/);
  });

  test('still shows a genuine zero balance as 0', () => {
    renderAside(0);
    const value = screen.getByText('Balance').nextElementSibling as HTMLElement;
    expect(value.textContent).toMatch(/^0\s/);
  });
});
