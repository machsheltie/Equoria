/**
 * OnboardingPage — BreedSelector wiring (Equoria-zanq, Spec 11.3.4)
 *
 * The onboarding "Choose Your Horse" step must render the real
 * BreedSelector component (grid/list, stat tendencies, lore, gender, name)
 * — NOT a plain <select>. This test asserts:
 *   - the legacy <select data-testid="breed-select"> is GONE
 *   - the real BreedSelector is rendered (data-testid="breed-selector")
 *   - every breed from the real /breeds API is selectable (no gatekeeping)
 *   - the breed group exposes a radiogroup with arrow-key navigation
 *
 * useBreeds is mocked ONLY to inject a deterministic real-API-shaped breed
 * list (no api-client vi.mock). authApi is not exercised here.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import OnboardingPage from '../OnboardingPage';
import * as useBreedsHook from '@/hooks/api/useBreeds';

vi.mock('@/hooks/api/useBreeds');
vi.mock('@/components/layout/PageBackground', () => ({
  usePageBackground: () => ({}),
  PageBackground: () => null,
}));

const realBreeds = [
  {
    id: 1,
    name: 'Arabian',
    loreBlurb: 'Desert-bred endurance horse with a fiery spirit.',
    statTendencies: {
      speed: { avg: 70, min: 60, max: 80 },
      stamina: { avg: 85, min: 75, max: 95 },
      agility: { avg: 65, min: 55, max: 75 },
      balance: { avg: 60, min: 50, max: 70 },
      precision: { avg: 62, min: 52, max: 72 },
      boldness: { avg: 68, min: 58, max: 78 },
    },
  },
  {
    id: 2,
    name: 'Thoroughbred',
    loreBlurb: 'Built for speed on the racecourse.',
    statTendencies: {
      speed: { avg: 90, min: 80, max: 99 },
      stamina: { avg: 70, min: 60, max: 80 },
      agility: { avg: 60, min: 50, max: 70 },
      balance: { avg: 58, min: 48, max: 68 },
      precision: { avg: 55, min: 45, max: 65 },
      boldness: { avg: 62, min: 52, max: 72 },
    },
  },
  {
    id: 3,
    name: 'Friesian',
    loreBlurb: 'Majestic black horse prized for dressage.',
    statTendencies: {
      speed: { avg: 55, min: 45, max: 65 },
      stamina: { avg: 65, min: 55, max: 75 },
      agility: { avg: 70, min: 60, max: 80 },
      balance: { avg: 80, min: 70, max: 90 },
      precision: { avg: 78, min: 68, max: 88 },
      boldness: { avg: 72, min: 62, max: 82 },
    },
  },
];

function renderOnboarding() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/onboarding']}>
        <OnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OnboardingPage — BreedSelector wiring (zanq)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // OnboardingPage persists the current step + horse selection to
    // sessionStorage; clear it so each test starts at the welcome step.
    sessionStorage.clear();
    vi.mocked(useBreedsHook.useBreeds).mockReturnValue({
      data: realBreeds,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useBreedsHook.useBreeds>);
  });

  it('advances to the horse step and renders the real BreedSelector (no <select>)', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    // Skip the welcome step to reach "Choose Your Horse".
    const skip = screen.getByTestId('onboarding-skip');
    await user.click(skip);

    expect(screen.getByTestId('breed-selector')).toBeInTheDocument();
    // The legacy plain <select> must be gone.
    expect(screen.queryByTestId('breed-select')).not.toBeInTheDocument();
  });

  it('exposes the breeds as a radiogroup with every breed selectable (no gatekeeping)', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    const skip = screen.getByTestId('onboarding-skip');
    await user.click(skip);

    const group = screen.getByRole('radiogroup', { name: /horse breeds/i });
    expect(group).toBeInTheDocument();

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(realBreeds.length);
    options.forEach((opt) => {
      expect(opt).not.toBeDisabled();
    });
  });

  it('supports arrow-key navigation between breeds', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    const skip = screen.getByTestId('onboarding-skip');
    await user.click(skip);

    const options = screen.getAllByRole('radio');
    options[0].focus();
    expect(options[0]).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveFocus();
    expect(options[1]).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowUp}');
    expect(options[0]).toHaveFocus();
    expect(options[0]).toHaveAttribute('aria-checked', 'true');
  });
});
