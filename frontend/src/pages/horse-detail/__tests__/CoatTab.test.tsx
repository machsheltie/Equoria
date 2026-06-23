/**
 * Component tests — CoatTab (Epic 31E-4, Equoria-ea3n + Equoria-oovy;
 * converted to MSW boundary under Equoria-fefh2.12)
 *
 * Boundary-level: the component renders against the REAL
 * `useHorseCoatColor` / `useHorseCoatGenetics` hooks (real React Query +
 * real `horsesApi` over `apiClient`) with the network boundary stubbed by
 * MSW (`server.use(...)`). This is NOT a
 * `vi.mock('@/hooks/useHorseCoatGenetics')`. It exercises the real query
 * keys (`['horse-coat-color', id]`, `['horse-coat-genetics', id]`), the
 * `enabled: Boolean(horseId)` gating, and the `{ success, message, data }`
 * envelope unwrap done by `apiClient.get` — where `data === null` is the
 * canonical legacy-horse signal — end-to-end.
 *
 * Real wire shapes (verified from the backend controller
 * backend/modules/horses/controllers/horseGeneticsController.mjs):
 *  - GET /api/v1/horses/:id/color    → { success, message, data:
 *      { horseId, horseName, colorName, shade, faceMarking, legMarkings,
 *        advancedMarkings, modifiers } } | { ..., data: null }   (getColor)
 *  - GET /api/v1/horses/:id/genetics → { success, message, data:
 *      { horseId, horseName, colorGenotype, phenotype } } |
 *      { ..., data: null }                                       (getGenetics)
 *  `apiClient.get` unwraps `.data`, so each hook's `data` is the payload
 *  object OR `null` (legacy horse). Covers the rendering branches:
 *   - Loading state
 *   - Full color + genotype payload
 *   - Modifier chip rendering (only when truthy)
 *   - null colorName → "not recorded" (never literal "Unknown")
 *   - Legacy null payload → empty-state copy
 *   - Genotype table rows + interpretation tooltips
 *
 * The previous over-mocked test set `isLoading` / `data` on the hook return
 * directly. The MSW conversion drives those same states through the real
 * network boundary: loading via an in-flight (delayed) response, null-data
 * via a `data: null` envelope, and populated state via the real `data: {...}`
 * envelope. Synchronous assertions on rendered data become async
 * `findBy*` / `waitFor` because the boundary resolves a tick later.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import { ReactNode } from 'react';
import { server } from '@/test/msw/server';
import type { HorseColorResponse, HorseGeneticsResponse } from '@/lib/api-client';
import CoatTab from '../CoatTab';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const colorPath = (id: number) => `${base}/api/v1/horses/${id}/color`;
const geneticsPath = (id: number) => `${base}/api/v1/horses/${id}/genetics`;

/**
 * Stub the coat-color boundary. Mirrors the real controller envelope:
 * `{ success, message, data: HorseColorResponse | null }`. `apiClient.get`
 * unwraps `.data`, so `useHorseCoatColor` receives the payload object or null.
 */
function stubColor(id: number, data: HorseColorResponse | null) {
  server.use(
    http.get(colorPath(id), () =>
      HttpResponse.json({ success: true, message: 'Color data retrieved successfully', data })
    )
  );
}

/**
 * Stub the coat-genetics boundary. Mirrors the real controller envelope:
 * `{ success, message, data: HorseGeneticsResponse | null }`.
 */
function stubGenetics(id: number, data: HorseGeneticsResponse | null) {
  server.use(
    http.get(geneticsPath(id), () =>
      HttpResponse.json({ success: true, message: 'Genetics data retrieved successfully', data })
    )
  );
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('CoatTab (31E-4 / ea3n + oovy)', () => {
  it('renders color, markings, modifiers, and genotype rows for a full payload', async () => {
    stubColor(1, {
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
    } as unknown as HorseColorResponse);

    stubGenetics(1, {
      horseId: 1,
      horseName: 'Pretty',
      colorGenotype: { E_Extension: 'E/e', A_Agouti: 'A/a' },
      phenotype: null,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={1} />
      </Wrapper>
    );

    // Color + shade — boundary resolves async, so wait for the first datum.
    const colorName = await screen.findByTestId('coat-color-name');
    expect(colorName).toHaveTextContent(/Bay/);
    expect(colorName).toHaveTextContent(/Dark/);

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

    // Genotype table rows — second query, also async.
    expect(await screen.findByTestId('coat-locus-E_Extension')).toHaveTextContent(/E\/e/);
    expect(screen.getByTestId('coat-locus-A_Agouti')).toHaveTextContent(/A\/a/);
  });

  it('renders "not recorded" (not literal "Unknown") when payload has null colorName (Equoria-3o5s, iwy3 convention)', async () => {
    // Backend returns a color object but colorName is null — rare but possible
    // for partially-migrated horses. Per frontend-integration-backlog.md
    // doctrine (line 258) + Equoria-iwy3, the UI must never render literal
    // 'Unknown'; it must use the 'not recorded' convention.
    stubColor(7, {
      horseId: 7,
      horseName: 'Partial',
      colorName: null,
      shade: null,
      faceMarking: null,
      legMarkings: null,
      advancedMarkings: null,
      modifiers: null,
    });
    stubGenetics(7, null);

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={7} />
      </Wrapper>
    );

    const colorName = await screen.findByTestId('coat-color-name');
    // Sentinel-positive: the exact defect (literal "Unknown") must NOT appear.
    expect(colorName).not.toHaveTextContent(/Unknown/);
    expect(colorName).toHaveTextContent(/not recorded/i);
  });

  it('renders empty-state when color data is null (legacy horse, AC3)', async () => {
    stubColor(99, null);
    stubGenetics(99, null);

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={99} />
      </Wrapper>
    );

    expect(await screen.findByText(/No color data available/i)).toBeInTheDocument();
    expect(await screen.findByText(/No genotype data available/i)).toBeInTheDocument();
  });

  it('renders loading state while queries are pending', async () => {
    // Delay BOTH boundary responses so the in-flight loading state is observable.
    server.use(
      http.get(colorPath(1), async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: null });
      }),
      http.get(geneticsPath(1), async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: null });
      })
    );

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={1} />
      </Wrapper>
    );

    expect(await screen.findByText(/Loading color data/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading genotype/i)).toBeInTheDocument();
  });

  it('hides modifier section when no modifiers are truthy (AC2)', async () => {
    stubColor(1, {
      horseId: 1,
      horseName: 'Plain',
      colorName: 'Chestnut',
      shade: null,
      faceMarking: null,
      legMarkings: null,
      advancedMarkings: null,
      modifiers: { isSooty: false, isFlaxen: false, isPangare: false, isRabicano: false },
    } as unknown as HorseColorResponse);
    stubGenetics(1, null);

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <CoatTab horseId={1} />
      </Wrapper>
    );

    // Wait for the color payload to land (Chestnut renders), then assert the
    // modifier/advanced sections are absent.
    expect(await screen.findByTestId('coat-color-name')).toHaveTextContent(/Chestnut/);
    await waitFor(() => expect(screen.queryByTestId('coat-modifiers')).not.toBeInTheDocument());
    expect(screen.queryByTestId('coat-advanced-markings')).not.toBeInTheDocument();
  });
});
