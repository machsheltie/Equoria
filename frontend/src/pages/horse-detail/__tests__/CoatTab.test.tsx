/**
 * Component tests — CoatTab (Epic 31E-4, Equoria-ea3n + Equoria-oovy)
 *
 * Covers the rendering branches:
 *  - Loading state
 *  - Full color + genotype payload
 *  - Modifier chip rendering (only when truthy)
 *  - Legacy null payload → empty-state copy
 *  - Genotype table rows + interpretation tooltips
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import CoatTab from '../CoatTab';
import * as coatHooks from '@/hooks/useHorseCoatGenetics';

vi.mock('@/hooks/useHorseCoatGenetics', () => ({
  useHorseCoatColor: vi.fn(),
  useHorseCoatGenetics: vi.fn(),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('CoatTab (31E-4 / ea3n + oovy)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders color, markings, modifiers, and genotype rows for a full payload', () => {
    vi.mocked(coatHooks.useHorseCoatColor).mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: {
        horseId: 1,
        horseName: 'Pretty',
        colorName: 'Bay',
        shade: 'Dark',
        faceMarking: 'Blaze',
        legMarkings: {
          frontLeft: 'Sock',
          frontRight: 'None',
          hindLeft: 'Stocking',
          hindRight: 'Coronet',
        },
        advancedMarkings: { bloodyShoulderPresent: true, snowflakePresent: false },
        modifiers: { isSooty: true, isFlaxen: false, isPangare: false, isRabicano: true },
      },
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatColor>);

    vi.mocked(coatHooks.useHorseCoatGenetics).mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: {
        horseId: 1,
        horseName: 'Pretty',
        colorGenotype: { E_Extension: 'E/e', A_Agouti: 'A/a' },
        phenotype: null,
      },
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatGenetics>);

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={1} />
      </Wrapper>
    );

    // Color + shade
    expect(screen.getByTestId('coat-color-name')).toHaveTextContent(/Bay/);
    expect(screen.getByTestId('coat-color-name')).toHaveTextContent(/Dark/);

    // Face marking
    expect(screen.getByTestId('coat-face-marking')).toHaveTextContent(/Blaze/);

    // Leg markings list
    const legs = screen.getByTestId('coat-leg-markings');
    expect(legs).toHaveTextContent(/Sock/);
    expect(legs).toHaveTextContent(/Stocking/);
    expect(legs).toHaveTextContent(/Coronet/);

    // Advanced markings — only the truthy ones (bloodyShoulderPresent) should render
    const adv = screen.getByTestId('coat-advanced-markings');
    expect(adv).toHaveTextContent(/bloody/i);
    expect(adv).not.toHaveTextContent(/snowflake/i);

    // Modifier chips — only truthy ones
    const mods = screen.getByTestId('coat-modifiers');
    expect(mods).toHaveTextContent(/Sooty/);
    expect(mods).toHaveTextContent(/Rabicano/);
    expect(mods).not.toHaveTextContent(/Flaxen/);
    expect(mods).not.toHaveTextContent(/Pangare/);

    // Genotype table rows
    expect(screen.getByTestId('coat-locus-E_Extension')).toHaveTextContent(/E\/e/);
    expect(screen.getByTestId('coat-locus-A_Agouti')).toHaveTextContent(/A\/a/);
  });

  it('renders empty-state when color data is null (legacy horse, AC3)', () => {
    vi.mocked(coatHooks.useHorseCoatColor).mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: null,
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatColor>);
    vi.mocked(coatHooks.useHorseCoatGenetics).mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: null,
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatGenetics>);

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={99} />
      </Wrapper>
    );

    expect(screen.getByText(/No color data available/i)).toBeInTheDocument();
    expect(screen.getByText(/No genotype data available/i)).toBeInTheDocument();
  });

  it('renders loading state while queries are pending', () => {
    vi.mocked(coatHooks.useHorseCoatColor).mockReturnValue({
      isLoading: true,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatColor>);
    vi.mocked(coatHooks.useHorseCoatGenetics).mockReturnValue({
      isLoading: true,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatGenetics>);

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={1} />
      </Wrapper>
    );

    expect(screen.getByText(/Loading color data/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading genotype/i)).toBeInTheDocument();
  });

  it('hides modifier section when no modifiers are truthy (AC2)', () => {
    vi.mocked(coatHooks.useHorseCoatColor).mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: {
        horseId: 1,
        horseName: 'Plain',
        colorName: 'Chestnut',
        shade: null,
        faceMarking: null,
        legMarkings: null,
        advancedMarkings: null,
        modifiers: { isSooty: false, isFlaxen: false, isPangare: false, isRabicano: false },
      },
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatColor>);
    vi.mocked(coatHooks.useHorseCoatGenetics).mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      data: null,
      error: null,
    } as unknown as ReturnType<typeof coatHooks.useHorseCoatGenetics>);

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={1} />
      </Wrapper>
    );

    expect(screen.queryByTestId('coat-modifiers')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coat-advanced-markings')).not.toBeInTheDocument();
  });
});
