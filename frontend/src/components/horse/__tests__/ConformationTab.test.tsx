/**
 * Tests for ConformationTab Component
 *
 * Tests cover:
 * - Loading states
 * - Error states with retry
 * - Successful data display with 8 score cards
 * - Breed comparison toggle functionality
 * - Responsive grid layout
 * - Accessibility
 *
 * Story 3-5: Conformation Scoring UI - Task 5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConformationTab from '../ConformationTab';

// Mock the hooks
vi.mock('@/hooks/api/useConformation', () => ({
  useHorseConformation: vi.fn(),
  useBreedAverages: vi.fn(),
}));

import { useHorseConformation, useBreedAverages } from '@/hooks/api/useConformation';

const mockConformation = {
  head: 85,
  neck: 78,
  shoulder: 92,
  back: 88,
  hindquarters: 90,
  legs: 82,
  hooves: 86,
  overall: 86,
};

const mockBreedData = {
  breedId: '1',
  breedName: 'Arabian',
  averages: {
    head: 75,
    neck: 73,
    shoulder: 78,
    back: 76,
    hindquarters: 77,
    legs: 74,
    hooves: 75,
    overall: 75.4,
  },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('ConformationTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('should display loading state while fetching conformation data', () => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('conformation-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading conformation scores...')).toBeInTheDocument();
    });

    it('should display loading state while fetching breed data', () => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: mockConformation,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('conformation-loading')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should display error message when conformation data fails to load', () => {
      const mockRefetch = vi.fn();
      vi.mocked(useHorseConformation).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch conformation'),
        refetch: mockRefetch,
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('conformation-error')).toBeInTheDocument();
      expect(screen.getByText('Error Loading Conformation Data')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch conformation')).toBeInTheDocument();
    });

    it('should call refetch when retry button is clicked', async () => {
      const mockRefetch = vi.fn();
      const user = userEvent.setup();
      vi.mocked(useHorseConformation).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch'),
        refetch: mockRefetch,
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('No Data State', () => {
    it('should display no data message when conformation is null', () => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('conformation-no-data')).toBeInTheDocument();
      expect(
        screen.getByText('No conformation data available for this horse.')
      ).toBeInTheDocument();
    });
  });

  describe('Successful Data Display', () => {
    beforeEach(() => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: mockConformation,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: mockBreedData,
        isLoading: false,
        error: null,
      } as any);
    });

    it('should render conformation tab with all score cards', () => {
      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('conformation-tab')).toBeInTheDocument();
      expect(screen.getByText('Conformation Scores')).toBeInTheDocument();

      // Should have 8 score cards (7 regions + overall)
      expect(screen.getByTestId('conformation-score-card-head')).toBeInTheDocument();
      expect(screen.getByTestId('conformation-score-card-neck')).toBeInTheDocument();
      expect(screen.getByTestId('conformation-score-card-shoulder')).toBeInTheDocument();
      expect(screen.getByTestId('conformation-score-card-back')).toBeInTheDocument();
      expect(screen.getByTestId('conformation-score-card-hindquarters')).toBeInTheDocument();
      expect(screen.getByTestId('conformation-score-card-legs')).toBeInTheDocument();
      expect(screen.getByTestId('conformation-score-card-hooves')).toBeInTheDocument();
      expect(screen.getByTestId('conformation-score-card-overall')).toBeInTheDocument();
    });

    it('should display correct scores for each region', () => {
      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('score-display-head')).toHaveTextContent('85');
      expect(screen.getByTestId('score-display-neck')).toHaveTextContent('78');
      expect(screen.getByTestId('score-display-shoulder')).toHaveTextContent('92');
      expect(screen.getByTestId('score-display-overall')).toHaveTextContent('86');
    });

    it('should display educational footer', () => {
      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByText('About Conformation Scoring:')).toBeInTheDocument();
      expect(
        screen.getByText(/Conformation scores assess physical structure/i)
      ).toBeInTheDocument();
    });
  });

  describe('Breed Comparison Toggle', () => {
    beforeEach(() => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: mockConformation,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: mockBreedData,
        isLoading: false,
        error: null,
      } as any);
    });

    it('should display breed comparison toggle when breedId is provided', () => {
      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('breed-comparison-toggle')).toBeInTheDocument();
      expect(screen.getByText('Show breed comparison')).toBeInTheDocument();
    });

    it('should not display breed comparison toggle when breedId is not provided', () => {
      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.queryByTestId('breed-comparison-toggle')).not.toBeInTheDocument();
    });

    it('should toggle comparison on/off when button is clicked', async () => {
      const user = userEvent.setup();
      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      const toggle = screen.getByTestId('breed-comparison-toggle');

      // Initially should be on (showComparison = true)
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('breed-info-banner')).toBeInTheDocument();

      // Click to turn off
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(screen.queryByTestId('breed-info-banner')).not.toBeInTheDocument();

      // Click to turn back on
      await user.click(toggle);
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(screen.getByTestId('breed-info-banner')).toBeInTheDocument();
    });

    it('should display breed info banner when comparison is enabled', () => {
      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('breed-info-banner')).toBeInTheDocument();
      expect(screen.getByText(/Comparing to Arabian Breed Average/i)).toBeInTheDocument();
    });

    it('should hide breed info banner when comparison is toggled off', async () => {
      const user = userEvent.setup();
      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      const toggle = screen.getByTestId('breed-comparison-toggle');
      await user.click(toggle);

      expect(screen.queryByTestId('breed-info-banner')).not.toBeInTheDocument();
    });

    it('should pass breed average to score cards when comparison is enabled', () => {
      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      // Check that breed comparison is displayed in at least one card
      expect(screen.getByTestId('breed-comparison-head')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: mockConformation,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: mockBreedData,
        isLoading: false,
        error: null,
      } as any);
    });

    it('should have proper ARIA labels for toggle button', () => {
      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      const toggle = screen.getByTestId('breed-comparison-toggle');
      expect(toggle).toHaveAttribute('role', 'switch');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      expect(toggle).toHaveAttribute('aria-label', 'Toggle breed comparison');
    });

    it('should have associated label for toggle', () => {
      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      const toggle = screen.getByTestId('breed-comparison-toggle');
      expect(toggle).toHaveAttribute('id', 'breed-comparison-toggle');

      const label = screen.getByLabelText('Show breed comparison');
      expect(label).toBe(toggle);
    });
  });

  describe('Edge Cases', () => {
    it('should handle breed error gracefully', () => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: mockConformation,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Breed data failed'),
      } as any);

      render(<ConformationTab horseId={1} breedId={1} />, { wrapper: createWrapper() });

      // Should still render conformation data without comparison
      expect(screen.getByTestId('conformation-tab')).toBeInTheDocument();
      expect(screen.queryByTestId('breed-info-banner')).not.toBeInTheDocument();
    });

    it('should handle all scores being 0', () => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: {
          head: 0,
          neck: 0,
          shoulder: 0,
          back: 0,
          hindquarters: 0,
          legs: 0,
          hooves: 0,
          overall: 0,
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('score-display-head')).toHaveTextContent('0');
      // Should have multiple "Poor" quality ratings (one for each region)
      const poorRatings = screen.getAllByText('Poor');
      expect(poorRatings.length).toBeGreaterThan(0);
    });

    it('should handle perfect scores (100)', () => {
      vi.mocked(useHorseConformation).mockReturnValue({
        data: {
          head: 100,
          neck: 100,
          shoulder: 100,
          back: 100,
          hindquarters: 100,
          legs: 100,
          hooves: 100,
          overall: 100,
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      vi.mocked(useBreedAverages).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any);

      render(<ConformationTab horseId={1} />, { wrapper: createWrapper() });

      expect(screen.getByTestId('score-display-head')).toHaveTextContent('100');
    });
  });
});
