/**
 * ColorPredictionChart branch coverage (task 23, fix round 1).
 *
 * WHY THIS FILE EXISTS. Before this, the only suite that rendered this
 * component was `pages/breeding/__tests__/BreedingPredictionsPanel.test.tsx`,
 * whose fixture serves `possibleColors: []`. That reaches the all-lethal branch
 * and nothing else — so the error notice, the legacy-horse notice, and the
 * probability bar on the happy path had no coverage at all while their chrome
 * was being retinted from raw palette classes to semantic tokens.
 *
 * WHAT IT ASSERTS. Each of the four render branches, with the honest text each
 * one owes the player. Colour is not asserted: the design audit owns the
 * absence of raw palette classes, and pinning replacement class strings would
 * just freeze styling. The one exception is a named regression guard on
 * `bg-amber-50/40` — a light-theme background that shipped inside a dark-theme
 * game and is the specific defect this migration retired.
 *
 * MSW intercepts at the fetch boundary, so the real `apiClient` request/unwrap
 * path and the real `useColorPrediction` hook both execute. No Equoria module
 * is mocked.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test/msw/server';
import ColorPredictionChart from '../ColorPredictionChart';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ENDPOINT = `${base}/api/v1/horses/breeding/color-prediction`;

const makeWrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
};

function renderChart() {
  return render(<ColorPredictionChart sireId={1} damId={2} />, { wrapper: makeWrapper() });
}

describe('ColorPredictionChart', () => {
  it('renders the forecast with a row and a probability bar per possible colour', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({
          success: true,
          data: {
            sireId: 1,
            damId: 2,
            possibleColors: [
              { colorName: 'Bay', probability: 0.5, percentage: '50%' },
              { colorName: 'Chestnut', probability: 0.25, percentage: '25%' },
              { colorName: 'Black', probability: 0.25, percentage: '25%' },
            ],
            totalCombinations: 8,
            lethalCombinationsFiltered: 1,
          },
        })
      )
    );

    renderChart();

    await waitFor(() => {
      expect(screen.getByTestId('color-prediction-chart')).toBeInTheDocument();
    });

    for (const colour of ['Bay', 'Chestnut', 'Black']) {
      expect(screen.getByTestId(`color-prediction-row-${colour}`)).toBeInTheDocument();
      expect(screen.getByText(colour)).toBeInTheDocument();
    }
    expect(screen.getByText('50%')).toBeInTheDocument();

    // The list is the accessible carrier for the distribution, not the bars.
    expect(
      screen.getByRole('list', { name: 'Possible offspring colors with probability' })
    ).toBeInTheDocument();

    // Derivation fine print stays honest about what was excluded.
    expect(screen.getByText(/8 genotype combinations considered/)).toBeInTheDocument();
    expect(screen.getByText(/1 lethal filtered/)).toBeInTheDocument();
  });

  it('scales each bar to its own probability, so the widths still differ per colour', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({
          success: true,
          data: {
            sireId: 1,
            damId: 2,
            possibleColors: [
              { colorName: 'Bay', probability: 0.75, percentage: '75%' },
              { colorName: 'Grey', probability: 0.25, percentage: '25%' },
            ],
            totalCombinations: 4,
            lethalCombinationsFiltered: 0,
          },
        })
      )
    );

    renderChart();

    await waitFor(() => {
      expect(screen.getByTestId('color-prediction-chart')).toBeInTheDocument();
    });

    const widthOf = (colour: string) => {
      const row = screen.getByTestId(`color-prediction-row-${colour}`);
      const fill = row.querySelector('[style*="width"]') as HTMLElement | null;
      expect(fill, `no probability bar for ${colour}`).not.toBeNull();
      return fill!.style.width;
    };

    expect(widthOf('Bay')).toBe('75%');
    expect(widthOf('Grey')).toBe('25%');
  });

  it('reports a failed forecast as an alert carrying the API message', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json(
          { success: false, message: 'Coat genetics service unavailable' },
          { status: 500 }
        )
      )
    );

    renderChart();

    await waitFor(() => {
      expect(screen.getByTestId('color-prediction-error')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Color prediction unavailable')).toBeInTheDocument();
  });

  it('tells the truth about a legacy pair instead of fabricating a distribution', async () => {
    // AC6: the backend returns data: null when a parent predates coat genetics.
    server.use(http.post(ENDPOINT, () => HttpResponse.json({ success: true, data: null })));

    renderChart();

    const notice = await waitFor(() => screen.getByTestId('color-prediction-legacy'));

    expect(
      screen.getByText(/one or both parents predate the coat-genetics system/)
    ).toBeInTheDocument();
    // No bars, no percentages — an honest empty state, not a fabricated chart.
    expect(screen.queryByRole('list')).toBeNull();

    // Regression guard on the specific defect this surface's migration retired:
    // a Tailwind light-theme background inside a dark-theme game.
    expect(notice.className).not.toContain('bg-amber-50');
  });

  it('explains the all-lethal case rather than rendering an empty chart', async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json({
          success: true,
          data: {
            sireId: 1,
            damId: 2,
            possibleColors: [],
            totalCombinations: 4,
            lethalCombinationsFiltered: 4,
          },
        })
      )
    );

    renderChart();

    await waitFor(() => {
      expect(screen.getByTestId('color-prediction-all-lethal')).toBeInTheDocument();
    });

    expect(screen.getByText('No viable offspring colors')).toBeInTheDocument();
    expect(screen.getByText(/filtered as lethal/)).toBeInTheDocument();
  });

  it('renders nothing for a self-cross, without calling the endpoint', () => {
    // No handler registered: MSW is configured with onUnhandledRequest 'error',
    // so an unexpected request would fail this test rather than pass silently.
    const { container } = render(<ColorPredictionChart sireId={7} damId={7} />, {
      wrapper: makeWrapper(),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
