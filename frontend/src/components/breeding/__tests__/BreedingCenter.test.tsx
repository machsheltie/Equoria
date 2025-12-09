import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BreedingCenter from '../BreedingCenter';
import * as useBreedingHooks from '@/hooks/api/useBreeding';
import * as useHorsesHooks from '@/hooks/api/useHorses';
import type { HorseSummary } from '@/lib/api-client';

// Mock the hooks
vi.mock('@/hooks/api/useBreeding');
vi.mock('@/hooks/api/useHorses');

describe('BreedingCenter', () => {
  let queryClient: QueryClient;

  const mockMares: HorseSummary[] = [
    {
      id: 1,
      name: 'Thunder Mare',
      breed: 'Thoroughbred',
      gender: 'Mare',
      sex: 'Female',
      ageYears: 5,
      level: 10,
    },
    {
      id: 2,
      name: 'Lightning Mare',
      breed: 'Arabian',
      gender: 'Female',
      sex: 'Female',
      ageYears: 4,
      level: 8,
    },
  ];

  const mockStallions: HorseSummary[] = [
    {
      id: 3,
      name: 'Storm Stallion',
      breed: 'Thoroughbred',
      gender: 'Stallion',
      sex: 'Male',
      ageYears: 6,
      level: 12,
    },
    {
      id: 4,
      name: 'Wind Stallion',
      breed: 'Arabian',
      gender: 'Male',
      sex: 'Male',
      ageYears: 5,
      level: 10,
    },
  ];

  const mockHorses = [...mockMares, ...mockStallions];

  const mockBreedFoal = vi.fn();
  const mockUseHorses = vi.fn();

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(useBreedingHooks.useBreedFoal).mockReturnValue({
      mutateAsync: mockBreedFoal,
      isPending: false,
      data: undefined,
      error: null,
    } as any);

    mockUseHorses.mockReturnValue({
      data: mockHorses,
      isLoading: false,
      error: null,
    });

    vi.mocked(useHorsesHooks.useHorses).mockImplementation(mockUseHorses);
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  describe('Tab Navigation', () => {
    it('renders all three tabs', () => {
      renderWithProvider(<BreedingCenter />);
      expect(screen.getByRole('tab', { name: /my mares/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /stud marketplace/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
    });

    it('defaults to My Mares tab', () => {
      renderWithProvider(<BreedingCenter />);
      const myMaresTab = screen.getByRole('tab', { name: /my mares/i });
      expect(myMaresTab).toHaveAttribute('aria-selected', 'true');
    });

    it('switches to Stud Marketplace tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      const studMarketplaceTab = screen.getByRole('tab', { name: /stud marketplace/i });
      await user.click(studMarketplaceTab);

      expect(studMarketplaceTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText(/browse available stallions/i)).toBeInTheDocument();
    });

    it('switches to History tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      const historyTab = screen.getByRole('tab', { name: /history/i });
      await user.click(historyTab);

      expect(historyTab).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('heading', { name: /breeding history/i })).toBeInTheDocument();
    });

    it('maintains tab state when switching between tabs', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      // Go to Stud Marketplace
      await user.click(screen.getByRole('tab', { name: /stud marketplace/i }));
      expect(screen.getByRole('heading', { name: /browse available stallions/i })).toBeInTheDocument();

      // Go to History
      await user.click(screen.getByRole('tab', { name: /history/i }));
      expect(screen.getByRole('heading', { name: /breeding history/i })).toBeInTheDocument();

      // Go back to My Mares
      await user.click(screen.getByRole('tab', { name: /my mares/i }));
      expect(screen.getByRole('combobox', { name: /mare/i })).toBeInTheDocument();
    });
  });

  describe('My Mares Tab', () => {
    it('displays mare selector with user mares', () => {
      renderWithProvider(<BreedingCenter />);
      const mareSelect = screen.getByRole('combobox', { name: /mare/i });
      expect(mareSelect).toBeInTheDocument();

      // Check that mares are in the dropdown
      const options = screen.getAllByRole('option');
      expect(options).toContainEqual(
        expect.objectContaining({ textContent: expect.stringContaining('Thunder Mare') })
      );
      expect(options).toContainEqual(
        expect.objectContaining({ textContent: expect.stringContaining('Lightning Mare') })
      );
    });

    it('displays stallion selector with available stallions', () => {
      renderWithProvider(<BreedingCenter />);
      const stallionSelect = screen.getByRole('combobox', { name: /stallion/i });
      expect(stallionSelect).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options).toContainEqual(
        expect.objectContaining({ textContent: expect.stringContaining('Storm Stallion') })
      );
      expect(options).toContainEqual(
        expect.objectContaining({ textContent: expect.stringContaining('Wind Stallion') })
      );
    });

    it('disables breed button when no mare selected', () => {
      renderWithProvider(<BreedingCenter />);
      const breedButton = screen.getByRole('button', { name: /breed now/i });
      expect(breedButton).toBeDisabled();
    });

    it('disables breed button when no stallion selected', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      const mareSelect = screen.getByRole('combobox', { name: /mare/i });
      await user.selectOptions(mareSelect, '1'); // Select Thunder Mare

      const breedButton = screen.getByRole('button', { name: /breed now/i });
      expect(breedButton).toBeDisabled();
    });

    it('enables breed button when both mare and stallion selected', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      const mareSelect = screen.getByRole('combobox', { name: /mare/i });
      const stallionSelect = screen.getByRole('combobox', { name: /stallion/i });

      await user.selectOptions(mareSelect, '1');
      await user.selectOptions(stallionSelect, '3');

      const breedButton = screen.getByRole('button', { name: /breed now/i });
      expect(breedButton).toBeEnabled();
    });

    it('calls breedFoal mutation with correct parameters', async () => {
      const user = userEvent.setup();
      mockBreedFoal.mockResolvedValue({ message: 'Breeding successful', foalId: 100 });

      renderWithProvider(<BreedingCenter />);

      await user.selectOptions(screen.getByRole('combobox', { name: /mare/i }), '1');
      await user.selectOptions(screen.getByRole('combobox', { name: /stallion/i }), '3');
      await user.click(screen.getByRole('button', { name: /breed now/i }));

      await waitFor(() => {
        expect(mockBreedFoal).toHaveBeenCalledWith({
          damId: 1,
          sireId: 3,
        });
      });
    });

    it('displays success message after successful breeding', async () => {
      const user = userEvent.setup();
      vi.mocked(useBreedingHooks.useBreedFoal).mockReturnValue({
        mutateAsync: mockBreedFoal,
        isPending: false,
        data: { message: 'Breeding successful! Foal ID: 100', foalId: 100 },
        error: null,
      } as any);

      renderWithProvider(<BreedingCenter />);

      await user.selectOptions(screen.getByRole('combobox', { name: /mare/i }), '1');
      await user.selectOptions(screen.getByRole('combobox', { name: /stallion/i }), '3');

      expect(screen.getByText(/breeding successful/i)).toBeInTheDocument();
    });

    it('displays error message on breeding failure', async () => {
      vi.mocked(useBreedingHooks.useBreedFoal).mockReturnValue({
        mutateAsync: mockBreedFoal,
        isPending: false,
        data: undefined,
        error: { message: 'Mare is not ready to breed' } as any,
      } as any);

      renderWithProvider(<BreedingCenter />);

      expect(screen.getByText(/mare is not ready to breed/i)).toBeInTheDocument();
    });

    it('shows loading state during breeding', () => {
      vi.mocked(useBreedingHooks.useBreedFoal).mockReturnValue({
        mutateAsync: mockBreedFoal,
        isPending: true,
        data: undefined,
        error: null,
      } as any);

      renderWithProvider(<BreedingCenter />);

      expect(screen.getByRole('button', { name: /breeding/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /breeding/i })).toBeDisabled();
    });
  });

  describe('Stud Marketplace Tab', () => {
    it('displays stallion cards when tab is active', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      await user.click(screen.getByRole('tab', { name: /stud marketplace/i }));

      expect(screen.getByText('Storm Stallion')).toBeInTheDocument();
      expect(screen.getByText('Wind Stallion')).toBeInTheDocument();
    });

    it('displays stallion details in marketplace', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      await user.click(screen.getByRole('tab', { name: /stud marketplace/i }));

      // Check Storm Stallion details - verify all details appear
      expect(screen.getByText('Storm Stallion')).toBeInTheDocument();
      // Check for breed and level (multiple matches possible, just verify they exist)
      const allText = screen.getByText('Storm Stallion').closest('.grid')?.textContent || '';
      expect(allText).toContain('Thoroughbred');
      expect(allText).toContain('Level 12');
    });

    it('filters stallions by breed', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      await user.click(screen.getByRole('tab', { name: /stud marketplace/i }));

      const breedFilter = screen.getByRole('combobox', { name: /filter by breed/i });
      await user.selectOptions(breedFilter, 'Thoroughbred');

      expect(screen.getByText('Storm Stallion')).toBeInTheDocument();
      expect(screen.queryByText('Wind Stallion')).not.toBeInTheDocument();
    });

    it('displays empty state when no stallions match filter', async () => {
      const user = userEvent.setup();

      // Use only mares (no stallions) to test empty state
      const customMares: HorseSummary[] = [
        {
          id: 1,
          name: 'Thunder Mare',
          breed: 'Thoroughbred',
          gender: 'Mare',
          sex: 'Female',
          ageYears: 5,
          level: 10,
        },
        {
          id: 2,
          name: 'Lightning Mare',
          breed: 'Arabian',
          gender: 'Mare',
          sex: 'Female',
          ageYears: 4,
          level: 8,
        },
      ];

      mockUseHorses.mockReturnValue({
        data: customMares, // Only mares, no stallions
        isLoading: false,
        error: null,
      });

      renderWithProvider(<BreedingCenter />);

      await user.click(screen.getByRole('tab', { name: /stud marketplace/i }));

      // With no stallions, should show empty state
      expect(screen.getByText(/no stallions found/i)).toBeInTheDocument();
    });
  });

  describe('History Tab', () => {
    it('displays breeding history table', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      await user.click(screen.getByRole('tab', { name: /history/i }));

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /date/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /mare/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /stallion/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /foal/i })).toBeInTheDocument();
    });

    it('displays empty state when no breeding history', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      await user.click(screen.getByRole('tab', { name: /history/i }));

      expect(screen.getByText(/no breeding history yet/i)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('displays loading state while fetching horses', () => {
      mockUseHorses.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      });

      renderWithProvider(<BreedingCenter />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('displays error state when fetching horses fails', () => {
      mockUseHorses.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch horses' },
      });

      renderWithProvider(<BreedingCenter />);

      expect(screen.getByText(/failed to fetch horses/i)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('applies correct CSS classes to tabs', () => {
      renderWithProvider(<BreedingCenter />);

      const myMaresTab = screen.getByRole('tab', { name: /my mares/i });
      expect(myMaresTab).toHaveClass('border-b-2');
    });

    it('highlights active tab', async () => {
      const user = userEvent.setup();
      renderWithProvider(<BreedingCenter />);

      const studMarketplaceTab = screen.getByRole('tab', { name: /stud marketplace/i });
      await user.click(studMarketplaceTab);

      expect(studMarketplaceTab).toHaveClass('border-emerald-600');
    });
  });
});
