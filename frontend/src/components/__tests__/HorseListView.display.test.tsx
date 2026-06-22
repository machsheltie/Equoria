/**
 * Horse List View Component Tests — Thumbnails & Primary Discipline Display
 *
 * Split (Equoria-urqic.2) from the original monolithic HorseListView.test.tsx.
 * Behavior groups in this file:
 * - Horse Thumbnails
 * - Primary Discipline Display
 *
 * Following TDD with NO MOCKING approach for authentic component validation.
 * Describe blocks moved VERBATIM; shared mockHorses + createTestWrapper come
 * from HorseListView.testUtils.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HorseListView from '../HorseListView';
import { mockHorses, createTestWrapper } from './HorseListView.testUtils';

describe('HorseListView Component', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
  });

  describe('Horse Thumbnails', () => {
    test('displays horse thumbnails in mobile card view', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      });

      // Check that thumbnails are rendered with proper alt text
      const thunderImg = screen.getByAltText('Thunder');
      expect(thunderImg).toBeInTheDocument();
      expect(thunderImg).toHaveAttribute('src', 'https://example.com/horses/thunder.jpg');

      const lightningImg = screen.getByAltText('Lightning');
      expect(lightningImg).toBeInTheDocument();
      expect(lightningImg).toHaveAttribute('src', 'https://example.com/horses/lightning.jpg');
    });

    test('displays horse thumbnails in desktop grid view', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set to grid view
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Check that thumbnails are rendered
      const thunderImg = screen.getByAltText('Thunder');
      expect(thunderImg).toBeInTheDocument();
      expect(thunderImg).toHaveAttribute('src', 'https://example.com/horses/thunder.jpg');

      const lightningImg = screen.getByAltText('Lightning');
      expect(lightningImg).toBeInTheDocument();
      expect(lightningImg).toHaveAttribute('src', 'https://example.com/horses/lightning.jpg');
    });

    test('displays horse thumbnails in desktop table view', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set to list view
      localStorage.setItem('horseListViewMode', 'list');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      });

      // Check that thumbnails are rendered in table
      const thunderImg = screen.getByAltText('Thunder');
      expect(thunderImg).toBeInTheDocument();
      expect(thunderImg).toHaveAttribute('src', 'https://example.com/horses/thunder.jpg');

      const lightningImg = screen.getByAltText('Lightning');
      expect(lightningImg).toBeInTheDocument();
      expect(lightningImg).toHaveAttribute('src', 'https://example.com/horses/lightning.jpg');
    });

    test('uses placeholder image when imageUrl is not provided', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set to grid view
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Storm doesn't have imageUrl, should use placeholder
      const stormImg = screen.getByAltText('Storm');
      expect(stormImg).toBeInTheDocument();
      expect(stormImg).toHaveAttribute('src', '/placeholder.svg');
    });

    test('thumbnails have proper styling and sizing', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Set to grid view
      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      const thunderImg = screen.getByAltText('Thunder');
      expect(thunderImg).toHaveClass('w-full', 'h-32', 'object-cover', 'rounded-t-lg');
    });

    test('thumbnails are responsive in different layouts', async () => {
      // Test mobile first
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { rerender } = render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      });

      let thunderImg = screen.getByAltText('Thunder');
      expect(thunderImg).toBeInTheDocument();

      // Switch to desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      // Force re-render by changing component props
      rerender(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      // Should still have thumbnail
      thunderImg = await screen.findByAltText('Thunder');
      expect(thunderImg).toBeInTheDocument();
    });
  });

  describe('Primary Discipline Display', () => {
    test('displays primary discipline in mobile card view instead of health', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      });

      // Thunder's highest discipline score is Western Pleasure (85)
      const westernPleasureElements = screen.getAllByText(/western pleasure/i);
      expect(westernPleasureElements.length).toBeGreaterThan(0);

      // Lightning's highest is Endurance (90)
      // Note: "Endurance" may also appear in filter checkboxes
      const enduranceElements = screen.getAllByText(/endurance/i);
      expect(enduranceElements.length).toBeGreaterThan(0);

      // Storm's highest is Barrel Racing (88)
      const barrelRacingElements = screen.getAllByText(/barrel racing/i);
      expect(barrelRacingElements.length).toBeGreaterThan(0);

      // Health percentage should NOT be displayed
      expect(screen.queryByText(/health:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/95%/)).not.toBeInTheDocument();
    });

    test('displays primary discipline in desktop grid view', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Use getAllByText for disciplines that may appear in multiple places
      const westernPleasureElements = screen.getAllByText(/western pleasure/i);
      expect(westernPleasureElements.length).toBeGreaterThan(0);

      const enduranceElements = screen.getAllByText(/endurance/i);
      expect(enduranceElements.length).toBeGreaterThan(0);

      const barrelRacingElements = screen.getAllByText(/barrel racing/i);
      expect(barrelRacingElements.length).toBeGreaterThan(0);

      // Health label should NOT be displayed
      expect(screen.queryByText(/health:/i)).not.toBeInTheDocument();
    });

    test('displays primary discipline in desktop table view', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      localStorage.setItem('horseListViewMode', 'list');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-layout')).toBeInTheDocument();
      });

      // Table header should show "Primary Discipline" instead of "Health"
      expect(screen.getByText(/primary discipline/i)).toBeInTheDocument();
      expect(screen.queryByText(/^health$/i)).not.toBeInTheDocument();

      // Discipline values should be displayed (may appear in filters too)
      const westernPleasureElements = screen.getAllByText(/western pleasure/i);
      expect(westernPleasureElements.length).toBeGreaterThan(0);

      const enduranceElements = screen.getAllByText(/endurance/i);
      expect(enduranceElements.length).toBeGreaterThan(0);

      const barrelRacingElements = screen.getAllByText(/barrel racing/i);
      expect(barrelRacingElements.length).toBeGreaterThan(0);
    });

    test('shows "None" when horse has no disciplines', async () => {
      const horseWithNoDisciplines = {
        ...mockHorses[0],
        id: 999,
        name: 'Untrained',
        disciplineScores: {},
      };

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={[horseWithNoDisciplines]} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      expect(screen.getByText(/none/i)).toBeInTheDocument();
    });

    test('tooltip shows all disciplines on hover (mobile)', async () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { container } = render(
        <TestWrapper>
          <HorseListView userId={1} horses={mockHorses} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('mobile-layout')).toBeInTheDocument();
      });

      // Find discipline display element with title attribute
      const disciplineElements = container.querySelectorAll('[title*="Discipline"]');
      expect(disciplineElements.length).toBeGreaterThan(0);

      // Thunder's tooltip should show all disciplines
      const thunderDiscipline = Array.from(disciplineElements).find((el) =>
        el.textContent?.includes('Western Pleasure')
      );
      expect(thunderDiscipline).toBeTruthy();
      expect(thunderDiscipline?.getAttribute('title')).toContain('Western Pleasure: 85');
      expect(thunderDiscipline?.getAttribute('title')).toContain('Dressage: 70');
    });

    test('calculatePrimaryDiscipline function handles edge cases', async () => {
      // Horse with tied scores (should pick first alphabetically or first in object)
      const tiedScoresHorse = {
        ...mockHorses[0],
        id: 888,
        name: 'Tied',
        disciplineScores: {
          Dressage: 80,
          'Show Jumping': 80,
        },
      };

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      localStorage.setItem('horseListViewMode', 'grid');

      render(
        <TestWrapper>
          <HorseListView userId={1} horses={[tiedScoresHorse]} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-layout')).toBeInTheDocument();
      });

      // Should display one of the tied disciplines (may also appear in filter checkboxes)
      const dressageElements = screen.queryAllByText(/^dressage$/i);
      const showJumpingElements = screen.queryAllByText(/show jumping/i);

      // At least one of the disciplines should be displayed
      const hasEitherDiscipline = dressageElements.length > 0 || showJumpingElements.length > 0;
      expect(hasEitherDiscipline).toBeTruthy();
    });
  });
});
