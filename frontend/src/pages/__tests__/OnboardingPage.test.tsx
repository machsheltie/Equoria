/**
 * OnboardingPage Tests — Story 21R-2 Task 10
 *
 * Verifies horse persistence: the onboarding wizard submits selected horse
 * data through advanceOnboarding, which customizes the registration starter horse.
 *
 * AC coverage:
 *   - authApi.advanceOnboarding called with correct payload (name, breedId, gender)
 *   - navigation goes to /stable on success
 *   - if advanceOnboarding fails, storage is preserved and user stays on onboarding
 *   - sessionStorage cleared on success path
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TestRouter } from '@/test/utils';

// ── Mock API client ────────────────────────────────────────────────────────────

const mockAdvanceOnboarding = vi.fn();

vi.mock('@/lib/api-client', () => ({
  authApi: {
    advanceOnboarding: mockAdvanceOnboarding,
  },
}));

// ── Mock useBreeds ─────────────────────────────────────────────────────────────

vi.mock('@/hooks/api/useBreeds', () => ({
  useBreeds: () => ({
    data: [{ id: 7, name: 'Thoroughbred', description: 'Fast', statTendencies: {}, loreBlurb: '' }],
    isLoading: false,
    error: null,
  }),
}));

// ── Mock usePageBackground ─────────────────────────────────────────────────────

vi.mock('@/components/layout/PageBackground', () => ({
  usePageBackground: () => ({}),
}));

// ── Mock navigate ──────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Mock toast ─────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestRouter>{children}</TestRouter>
    </QueryClientProvider>
  );
}

// Force onboarding to step 2 (Ready) so the "Begin" button is visible
function seedStep2Horse() {
  sessionStorage.setItem('equoria-onboarding-step', '2');
  sessionStorage.setItem(
    'equoria-onboarding-horse',
    JSON.stringify({
      breedId: 7,
      breedName: 'Thoroughbred',
      gender: 'Mare',
      horseName: 'Starlight',
    })
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('OnboardingPage — Task 10 horse persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.removeItem('equoria-onboarding-done');
  });

  it('calls advanceOnboarding with selected starter horse data on completion', async () => {
    const { default: OnboardingPage } = await import('../OnboardingPage');
    mockAdvanceOnboarding.mockResolvedValue({
      data: { step: 10, completed: true, horse: { id: 42, name: 'Starlight' } },
    });

    seedStep2Horse();

    render(<OnboardingPage />, { wrapper: makeWrapper() });

    const beginBtn = await screen.findByTestId('onboarding-next');
    await userEvent.click(beginBtn);

    await waitFor(() => {
      expect(mockAdvanceOnboarding).toHaveBeenCalledWith({
        horseName: 'Starlight',
        breedId: 7,
        gender: 'Mare',
      });
    });
  });

  it('navigates to /stable on successful completion', async () => {
    const { default: OnboardingPage } = await import('../OnboardingPage');
    mockAdvanceOnboarding.mockResolvedValue({
      data: { step: 10, completed: true, horse: { id: 42, name: 'Starlight' } },
    });

    seedStep2Horse();

    render(<OnboardingPage />, { wrapper: makeWrapper() });

    const beginBtn = await screen.findByTestId('onboarding-next');
    await userEvent.click(beginBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/stable', { replace: true });
    });
  });

  it('preserves selections and stays on onboarding when advanceOnboarding fails', async () => {
    const { default: OnboardingPage } = await import('../OnboardingPage');
    mockAdvanceOnboarding.mockRejectedValue(new Error('Network error'));

    seedStep2Horse();

    render(<OnboardingPage />, { wrapper: makeWrapper() });

    const beginBtn = await screen.findByTestId('onboarding-next');
    await userEvent.click(beginBtn);

    await waitFor(() => {
      expect(mockAdvanceOnboarding).toHaveBeenCalledTimes(1);
    });

    expect(mockNavigate).not.toHaveBeenCalledWith('/stable', { replace: true });
    expect(sessionStorage.getItem('equoria-onboarding-step')).toBe('2');
    expect(sessionStorage.getItem('equoria-onboarding-horse')).toContain('Starlight');

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalled();
  });

  it('clears sessionStorage on successful completion', async () => {
    const { default: OnboardingPage } = await import('../OnboardingPage');
    mockAdvanceOnboarding.mockResolvedValue({
      data: { step: 10, completed: true, horse: { id: 42, name: 'Starlight' } },
    });

    seedStep2Horse();

    // Confirm storage is seeded before render
    expect(sessionStorage.getItem('equoria-onboarding-step')).toBe('2');

    render(<OnboardingPage />, { wrapper: makeWrapper() });

    const beginBtn = await screen.findByTestId('onboarding-next');
    await userEvent.click(beginBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/stable', { replace: true });
    });

    expect(sessionStorage.getItem('equoria-onboarding-step')).toBeNull();
    expect(sessionStorage.getItem('equoria-onboarding-horse')).toBeNull();
  });
});
