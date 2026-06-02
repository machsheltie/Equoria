/**
 * HorseDetailPage — page-level rendering + data display suites (Equoria-snx5i).
 *
 * Split verbatim from the former 886-line
 * frontend/src/pages/__tests__/HorseDetailPage.test.tsx (Component Rendering +
 * Data Display describe blocks) per the Equoria-g6aed 300-line-per-file AC.
 * Assertions are unchanged; only their file home moved. Shared fixtures live in
 * pageDetail.testHelpers.tsx.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import HorseDetailPage from '../../HorseDetailPage';
import {
  mockHorse,
  originalFetch,
  createFetchMock,
  createTestWrapper,
} from './pageDetail.testHelpers';

describe('HorseDetailPage Component', () => {
  beforeEach(() => {
    // Set default mock that handles genetics endpoints
    global.fetch = createFetchMock();
  });

  afterEach(() => {
    // Clean up after each test
    global.fetch = originalFetch;
  });

  describe('Component Rendering', () => {
    test('renders horse detail page with loading state', async () => {
      // Mock fetch to simulate loading
      global.fetch = vi.fn(() => new Promise(() => {})); // Never resolves

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      // Should show loading state — skeleton uses aria-label="Loading horse details"
      await waitFor(() => {
        const loadingRegion = screen.queryByLabelText(/loading horse details/i);
        expect(loadingRegion).toBeTruthy();
      });
    });

    test('renders horse detail page with horse data', async () => {
      // Mock successful fetch
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      // Wait for horse data to load
      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Verify basic horse information (using getAllByText for flexible matching)
      expect(screen.getAllByText(/thoroughbred/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/5 years old/i)).toBeInTheDocument();
      expect(screen.getAllByText(/stallion/i).length).toBeGreaterThan(0);
    });

    test('renders all stat displays correctly', async () => {
      global.fetch = createFetchMock({ success: true, data: mockHorse });

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Verify all stats are displayed (using getAllByText since multiple elements may contain these words)
      expect(screen.getAllByText(/speed/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/stamina/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/agility/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/strength/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/intelligence/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/health/i).length).toBeGreaterThan(0);
    });
  });

  describe('Data Display', () => {
    test('displays horse description if available', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: mockHorse }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Verify description is shown
      expect(screen.getByText(/magnificent thoroughbred/i)).toBeInTheDocument();
    });

    test('handles missing optional fields gracefully', async () => {
      const horseWithoutOptionalFields = {
        ...mockHorse,
        description: undefined,
        imageUrl: undefined,
        traits: undefined,
        parentIds: undefined,
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: horseWithoutOptionalFields }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // Component should still render without errors (but no description so only one match)
      expect(screen.getByText(/thoroughbred/i)).toBeInTheDocument();
    });

    test('displays placeholder image when imageUrl is missing', async () => {
      const horseWithoutImage = {
        ...mockHorse,
        imageUrl: undefined,
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true, data: horseWithoutImage }),
        } as Response)
      );

      const TestWrapper = createTestWrapper('1');
      window.history.pushState({}, 'Test', '/horses/1');

      render(
        <TestWrapper>
          <HorseDetailPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Thunder')).toBeInTheDocument();
      });

      // When imageUrl is missing, the page falls back via getHorseImage which
      // first looks up a breed-specific image (Thoroughbred → thoroughbred.png)
      // and only uses /placeholder.svg if no breed image exists. The mock
      // horse is a Thoroughbred, so the breed image is used here.
      const horseImage = screen.getByAltText('Thunder');
      expect(horseImage).toHaveAttribute(
        'src',
        expect.stringMatching(/placeholder|breeds\/thoroughbred/)
      );
    });
  });
});
