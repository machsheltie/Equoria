/**
 * Horse List View Component Tests — Training Eligibility
 *
 * Split (Equoria-urqic.2) from the original monolithic HorseListView.test.tsx.
 * Behavior groups in this file:
 * - Eligibility Display
 * - Eligibility Filter
 * - Eligibility Integration
 *
 * Story 4-2: Training Eligibility Display - Task 4.
 * Following TDD with NO MOCKING approach for authentic component validation.
 * Describe blocks moved VERBATIM (including each describe's local
 * eligibilityTestHorses fixture and beforeEach); shared createTestWrapper
 * comes from HorseListView.testUtils.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HorseListView from '../HorseListView';
import { createTestWrapper } from './HorseListView.testUtils';

describe('HorseListView Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
  });

  /**
   * Eligibility Display Tests
   * Tests for training eligibility indicator integration
   * Story 4-2: Training Eligibility Display - Task 4
   */
  describe('Eligibility Display', () => {
    // Mock horses with different eligibility states
    const eligibilityTestHorses = [
      {
        id: 1,
        name: 'ReadyHorse',
        breed: 'Thoroughbred',
        age: 5, // Eligible age (3-20)
        level: 10,
        health: 95,
        xp: 1500,
        stats: {
          speed: 85,
          stamina: 80,
          agility: 75,
          balance: 70,
          precision: 72,
          intelligence: 68,
          boldness: 78,
          flexibility: 65,
          obedience: 70,
          focus: 75,
        },
        disciplineScores: { 'Western Pleasure': 85 },
        trainingCooldown: undefined, // No cooldown - ready to train
      },
      {
        id: 2,
        name: 'CooldownHorse',
        breed: 'Arabian',
        age: 5,
        level: 5,
        health: 100,
        xp: 500,
        stats: {
          speed: 90,
          stamina: 85,
          agility: 88,
          balance: 82,
          precision: 80,
          intelligence: 85,
          boldness: 75,
          flexibility: 78,
          obedience: 80,
          focus: 82,
        },
        disciplineScores: { Endurance: 90 },
        trainingCooldown: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days in future
      },
      {
        id: 3,
        name: 'TooYoungHorse',
        breed: 'Quarter Horse',
        age: 2, // Too young (under 3)
        level: 1,
        health: 100,
        xp: 0,
        stats: {
          speed: 50,
          stamina: 50,
          agility: 50,
          balance: 50,
          precision: 50,
          intelligence: 50,
          boldness: 50,
          flexibility: 50,
          obedience: 50,
          focus: 50,
        },
        disciplineScores: {},
      },
      {
        id: 4,
        name: 'TooOldHorse',
        breed: 'Friesian',
        age: 25, // Too old (over 20)
        level: 30,
        health: 70,
        xp: 10000,
        stats: {
          speed: 60,
          stamina: 55,
          agility: 50,
          balance: 55,
          precision: 65,
          intelligence: 70,
          boldness: 60,
          flexibility: 45,
          obedience: 75,
          focus: 65,
        },
        disciplineScores: { Dressage: 95 },
      },
    ];

    beforeEach(() => {
      localStorage.clear();
      // Set desktop viewport for consistent testing
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    test('eligibility indicator appears on each horse card in grid view', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Check that eligibility indicators are rendered for each horse
      const eligibilityIndicators = screen.getAllByTestId('eligibility-indicator');
      expect(eligibilityIndicators.length).toBe(eligibilityTestHorses.length);
    });

    test('Train button shows only for eligible horses in grid view', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // ReadyHorse (id=1) should have enabled train button
      const readyTrainButton = screen.getByTestId('train-button-1');
      expect(readyTrainButton).toBeInTheDocument();
      expect(readyTrainButton).not.toBeDisabled();

      // CooldownHorse (id=2) should have disabled train button
      const cooldownTrainButton = screen.getByTestId('train-button-disabled-2');
      expect(cooldownTrainButton).toBeInTheDocument();
      expect(cooldownTrainButton).toBeDisabled();

      // TooYoungHorse (id=3) should have disabled train button
      const youngTrainButton = screen.getByTestId('train-button-disabled-3');
      expect(youngTrainButton).toBeInTheDocument();
      expect(youngTrainButton).toBeDisabled();

      // TooOldHorse (id=4) should have disabled train button
      const oldTrainButton = screen.getByTestId('train-button-disabled-4');
      expect(oldTrainButton).toBeInTheDocument();
      expect(oldTrainButton).toBeDisabled();
    });

    test('Train button navigates to training page for eligible horse', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Click train button for eligible horse
      const trainButton = screen.getByTestId('train-button-1');
      fireEvent.click(trainButton);

      // Navigation is handled by React Router - button should still be in document
      expect(trainButton).toBeInTheDocument();
    });

    test('eligibility status colors are correct in table view', async () => {
      localStorage.setItem('horseListViewMode', 'list');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      });

      // Check eligibility indicators have correct status text
      // Ready horse should show "Ready to Train"
      expect(screen.getByText('Ready to Train')).toBeInTheDocument();

      // Cooldown horse should show "On Cooldown"
      expect(screen.getByText('On Cooldown')).toBeInTheDocument();

      // Too young horse should show "Too Young"
      expect(screen.getByText('Too Young')).toBeInTheDocument();

      // Too old horse should show "Too Old"
      expect(screen.getByText('Too Old')).toBeInTheDocument();
    });

    test('compact variant is used for eligibility indicators', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // All eligibility indicators should use compact styling (px-2 py-1 for compact)
      const indicators = screen.getAllByTestId('eligibility-indicator');
      indicators.forEach((indicator) => {
        expect(indicator).toHaveClass('px-2', 'py-1');
      });
    });
  });

  /**
   * Eligibility Filter Tests
   * Tests for the eligibility filter component integration
   * Story 4-2: Training Eligibility Display - Task 4
   */
  describe('Eligibility Filter', () => {
    // Use the same eligibility test horses
    const eligibilityTestHorses = [
      {
        id: 1,
        name: 'ReadyHorse',
        breed: 'Thoroughbred',
        age: 5,
        level: 10,
        health: 95,
        xp: 1500,
        stats: {
          speed: 85,
          stamina: 80,
          agility: 75,
          balance: 70,
          precision: 72,
          intelligence: 68,
          boldness: 78,
          flexibility: 65,
          obedience: 70,
          focus: 75,
        },
        disciplineScores: { 'Western Pleasure': 85 },
        trainingCooldown: undefined,
      },
      {
        id: 2,
        name: 'CooldownHorse',
        breed: 'Arabian',
        age: 5,
        level: 5,
        health: 100,
        xp: 500,
        stats: {
          speed: 90,
          stamina: 85,
          agility: 88,
          balance: 82,
          precision: 80,
          intelligence: 85,
          boldness: 75,
          flexibility: 78,
          obedience: 80,
          focus: 82,
        },
        disciplineScores: { Endurance: 90 },
        trainingCooldown: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 3,
        name: 'TooYoungHorse',
        breed: 'Quarter Horse',
        age: 2,
        level: 1,
        health: 100,
        xp: 0,
        stats: {
          speed: 50,
          stamina: 50,
          agility: 50,
          balance: 50,
          precision: 50,
          intelligence: 50,
          boldness: 50,
          flexibility: 50,
          obedience: 50,
          focus: 50,
        },
        disciplineScores: {},
      },
      {
        id: 4,
        name: 'TooOldHorse',
        breed: 'Friesian',
        age: 25,
        level: 30,
        health: 70,
        xp: 10000,
        stats: {
          speed: 60,
          stamina: 55,
          agility: 50,
          balance: 55,
          precision: 65,
          intelligence: 70,
          boldness: 60,
          flexibility: 45,
          obedience: 75,
          focus: 65,
        },
        disciplineScores: { Dressage: 95 },
      },
    ];

    beforeEach(() => {
      localStorage.clear();
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    test('all filter buttons render with correct counts', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Check all filter buttons exist
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-ready')).toBeInTheDocument();
      expect(screen.getByTestId('filter-cooldown')).toBeInTheDocument();
      expect(screen.getByTestId('filter-ineligible')).toBeInTheDocument();

      // Check counts based on EligibilityFilter's canTrain-based logic
      // Note: canTrain() only checks age < 3 and cooldown, NOT age > 20
      // So TooOldHorse (age=25) is counted as "ready" by the filter component
      // All: 4, Ready: 2 (age 5 + age 25), Cooldown: 1, Ineligible: 1 (age 2)
      expect(screen.getByTestId('count-all')).toHaveTextContent('(4)');
      expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
      expect(screen.getByTestId('count-cooldown')).toHaveTextContent('(1)');
      expect(screen.getByTestId('count-ineligible')).toHaveTextContent('(1)');
    });

    test('filtering to "ready" shows only eligible horses', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Click "Ready" filter
      fireEvent.click(screen.getByTestId('filter-ready'));

      // Should show ReadyHorse and TooOldHorse (canTrain doesn't check age > 20)
      // Note: The train BUTTON will be disabled for TooOldHorse, but filter shows it
      await waitFor(() => {
        expect(screen.getByText('ReadyHorse')).toBeInTheDocument();
        expect(screen.getByText('TooOldHorse')).toBeInTheDocument();
        expect(screen.queryByText('CooldownHorse')).not.toBeInTheDocument();
        expect(screen.queryByText('TooYoungHorse')).not.toBeInTheDocument();
      });
    });

    test('filtering to "cooldown" shows only cooldown horses', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Click "Cooldown" filter
      fireEvent.click(screen.getByTestId('filter-cooldown'));

      // Should only show CooldownHorse
      await waitFor(() => {
        expect(screen.getByText('CooldownHorse')).toBeInTheDocument();
        expect(screen.queryByText('ReadyHorse')).not.toBeInTheDocument();
        expect(screen.queryByText('TooYoungHorse')).not.toBeInTheDocument();
        expect(screen.queryByText('TooOldHorse')).not.toBeInTheDocument();
      });
    });

    test('filtering to "ineligible" shows only ineligible horses', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Click "Ineligible" filter
      fireEvent.click(screen.getByTestId('filter-ineligible'));

      // Should show only TooYoungHorse (canTrain doesn't check age > 20, so TooOldHorse is "ready")
      await waitFor(() => {
        expect(screen.getByText('TooYoungHorse')).toBeInTheDocument();
        expect(screen.queryByText('TooOldHorse')).not.toBeInTheDocument(); // counted as "ready"
        expect(screen.queryByText('ReadyHorse')).not.toBeInTheDocument();
        expect(screen.queryByText('CooldownHorse')).not.toBeInTheDocument();
      });
    });

    test('filter combines with existing search', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Set search term
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Horse' } });

      // Should show all horses matching 'Horse'
      await waitFor(() => {
        expect(screen.getByText('ReadyHorse')).toBeInTheDocument();
        expect(screen.getByText('CooldownHorse')).toBeInTheDocument();
      });

      // Now apply "ready" filter
      fireEvent.click(screen.getByTestId('filter-ready'));

      // Should only show ReadyHorse (search + eligibility combined)
      await waitFor(() => {
        expect(screen.getByText('ReadyHorse')).toBeInTheDocument();
        expect(screen.queryByText('CooldownHorse')).not.toBeInTheDocument();
      });
    });
  });

  /**
   * Eligibility Integration Tests
   * Tests for combined filter functionality and edge cases
   * Story 4-2: Training Eligibility Display - Task 4
   */
  describe('Eligibility Integration', () => {
    const eligibilityTestHorses = [
      {
        id: 1,
        name: 'ReadyThoroughbred',
        breed: 'Thoroughbred',
        age: 5,
        level: 10,
        health: 95,
        xp: 1500,
        stats: {
          speed: 85,
          stamina: 80,
          agility: 75,
          balance: 70,
          precision: 72,
          intelligence: 68,
          boldness: 78,
          flexibility: 65,
          obedience: 70,
          focus: 75,
        },
        disciplineScores: { 'Western Pleasure': 85 },
        trainingCooldown: undefined,
      },
      {
        id: 2,
        name: 'CooldownArabian',
        breed: 'Arabian',
        age: 5,
        level: 5,
        health: 100,
        xp: 500,
        stats: {
          speed: 90,
          stamina: 85,
          agility: 88,
          balance: 82,
          precision: 80,
          intelligence: 85,
          boldness: 75,
          flexibility: 78,
          obedience: 80,
          focus: 82,
        },
        disciplineScores: { Endurance: 90 },
        trainingCooldown: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 3,
        name: 'YoungQuarter',
        breed: 'Quarter Horse',
        age: 2,
        level: 1,
        health: 100,
        xp: 0,
        stats: {
          speed: 50,
          stamina: 50,
          agility: 50,
          balance: 50,
          precision: 50,
          intelligence: 50,
          boldness: 50,
          flexibility: 50,
          obedience: 50,
          focus: 50,
        },
        disciplineScores: {},
      },
      {
        id: 4,
        name: 'ReadyArabian',
        breed: 'Arabian',
        age: 6,
        level: 8,
        health: 90,
        xp: 1200,
        stats: {
          speed: 88,
          stamina: 82,
          agility: 85,
          balance: 80,
          precision: 78,
          intelligence: 82,
          boldness: 72,
          flexibility: 75,
          obedience: 78,
          focus: 80,
        },
        disciplineScores: { Racing: 88 },
        trainingCooldown: undefined,
      },
    ];

    beforeEach(() => {
      localStorage.clear();
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    test('eligibility filter works with breed filter', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Click "Ready" filter first
      fireEvent.click(screen.getByTestId('filter-ready'));

      // Should show ReadyThoroughbred and ReadyArabian
      await waitFor(() => {
        expect(screen.getByText('ReadyThoroughbred')).toBeInTheDocument();
        expect(screen.getByText('ReadyArabian')).toBeInTheDocument();
      });

      // Now filter by breed (search for Arabian)
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Arabian' } });

      // Should only show ReadyArabian (ready + breed match)
      await waitFor(() => {
        expect(screen.getByText('ReadyArabian')).toBeInTheDocument();
        expect(screen.queryByText('ReadyThoroughbred')).not.toBeInTheDocument();
      });
    });

    test('eligibility filter works with search', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Search for "Ready" in name
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Ready' } });

      // Should show ReadyThoroughbred and ReadyArabian
      await waitFor(() => {
        expect(screen.getByText('ReadyThoroughbred')).toBeInTheDocument();
        expect(screen.getByText('ReadyArabian')).toBeInTheDocument();
      });

      // Apply cooldown filter (should show nothing since "Ready" horses are not on cooldown)
      fireEvent.click(screen.getByTestId('filter-cooldown'));

      // Should show empty state since no "Ready*" named horses are on cooldown
      await waitFor(() => {
        expect(screen.queryByText('ReadyThoroughbred')).not.toBeInTheDocument();
        expect(screen.queryByText('ReadyArabian')).not.toBeInTheDocument();
      });
    });

    test('multiple filters combined correctly', async () => {
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Start with all horses (4)
      expect(screen.getByTestId('count-all')).toHaveTextContent('(4)');

      // Filter to ready (should be 2: ReadyThoroughbred, ReadyArabian)
      fireEvent.click(screen.getByTestId('filter-ready'));

      await waitFor(() => {
        expect(screen.getByText('ReadyThoroughbred')).toBeInTheDocument();
        expect(screen.getByText('ReadyArabian')).toBeInTheDocument();
      });

      // Search for "Thoroughbred"
      const searchInput = screen.getByPlaceholderText(/search horses/i);
      fireEvent.change(searchInput, { target: { value: 'Thoroughbred' } });

      // Should only show ReadyThoroughbred
      await waitFor(() => {
        expect(screen.getByText('ReadyThoroughbred')).toBeInTheDocument();
        expect(screen.queryByText('ReadyArabian')).not.toBeInTheDocument();
      });
    });

    test('filter counts update when data changes', async () => {
      const { rerender } = render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('count-ready')).toHaveTextContent('(2)');
      });

      // Add another ready horse
      const updatedHorses = [
        ...eligibilityTestHorses,
        {
          id: 5,
          name: 'NewReadyHorse',
          breed: 'Friesian',
          age: 7,
          level: 12,
          health: 100,
          xp: 2000,
          stats: {
            speed: 70,
            stamina: 75,
            agility: 65,
            balance: 70,
            precision: 72,
            intelligence: 68,
            boldness: 65,
            flexibility: 60,
            obedience: 78,
            focus: 70,
          },
          disciplineScores: { Dressage: 80 },
          trainingCooldown: undefined,
        },
      ];

      rerender(
        <TestWrapper>
          <HorseListView userId={1} horses={updatedHorses} />
        </TestWrapper>
      );

      // Ready count should update to 3
      await waitFor(() => {
        expect(screen.getByTestId('count-ready')).toHaveTextContent('(3)');
        expect(screen.getByTestId('count-all')).toHaveTextContent('(5)');
      });
    });

    test('accessibility of eligibility filter controls', async () => {
      render(
        <TestWrapper>
          <HorseListView userId={1} horses={eligibilityTestHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('eligibility-filter')).toBeInTheDocument();
      });

      // Check filter group has proper ARIA role
      const filterGroup = screen.getByTestId('eligibility-filter');
      expect(filterGroup).toHaveAttribute('role', 'group');
      expect(filterGroup).toHaveAttribute('aria-label', 'Filter horses by training eligibility');

      // Check buttons have proper aria-labels
      const allButton = screen.getByTestId('filter-all');
      expect(allButton).toHaveAttribute('aria-label', 'Show all horses');
      expect(allButton).toHaveAttribute('aria-pressed', 'true'); // Default selected

      const readyButton = screen.getByTestId('filter-ready');
      expect(readyButton).toHaveAttribute('aria-label', 'Show horses ready to train');
      expect(readyButton).toHaveAttribute('aria-pressed', 'false');

      // Click ready button and check aria-pressed updates
      fireEvent.click(readyButton);

      await waitFor(() => {
        expect(readyButton).toHaveAttribute('aria-pressed', 'true');
        expect(allButton).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });
});
