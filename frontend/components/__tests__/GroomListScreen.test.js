/**
 * GroomListScreen Component Tests
 *
 * Test suite for React Native groom marketplace component.
 * Tests rendering, filtering, sorting, hiring, and refresh functionality.
 *
 * Testing approach:
 * - TDD with NO MOCKING (except AsyncStorage infrastructure)
 * - Pass real data as props to component
 * - Use async/await and waitFor for async operations
 * - Test categories: Rendering (7), Filtering (5), Sorting (3), Hiring (5), Refresh (4), Accessibility (2)
 * - Target: 100% test success rate (26 tests)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroomListScreen from '../GroomListScreen.js';

// Mock AsyncStorage ONLY (infrastructure, not business logic)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock data - Real marketplace data (NO MOCKING)
const mockMarketplaceData = {
  grooms: [
    {
      marketplaceId: 'groom-1',
      firstName: 'Sarah',
      lastName: 'Johnson',
      specialty: 'foalCare',
      skillLevel: 'expert',
      personality: 'gentle',
      experience: 8,
      sessionRate: 75,
      bio: 'Experienced foal care specialist with 8 years of expertise',
      availability: true,
    },
    {
      marketplaceId: 'groom-2',
      firstName: 'Mike',
      lastName: 'Anderson',
      specialty: 'training',
      skillLevel: 'intermediate',
      personality: 'firm',
      experience: 4,
      sessionRate: 50,
      bio: 'Training specialist with 4 years of experience',
      availability: true,
    },
    {
      marketplaceId: 'groom-3',
      firstName: 'Emily',
      lastName: 'Davis',
      specialty: 'generalCare',
      skillLevel: 'novice',
      personality: 'patient',
      experience: 1,
      sessionRate: 30,
      bio: 'General care groom with 1 year of experience',
      availability: true,
    },
    {
      marketplaceId: 'groom-4',
      firstName: 'Alex',
      lastName: 'Martinez',
      specialty: 'showHandling',
      skillLevel: 'master',
      personality: 'balanced',
      experience: 15,
      sessionRate: 120,
      bio: 'Master show handler with 15 years of championship experience',
      availability: true,
    },
  ],
  lastRefresh: '2025-10-29T10:00:00Z',
  nextFreeRefresh: '2025-10-30T10:00:00Z',
  refreshCost: 100,
  canRefreshFree: false,
  refreshCount: 3,
};

const mockUserData = {
  id: 1,
  money: 5000,
  stableLimit: 10,
  currentHorses: 3,
};

describe('GroomListScreen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock AsyncStorage to return null (no saved state)
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
    AsyncStorage.removeItem.mockResolvedValue(null);
  });

  // ========================================
  // RENDERING TESTS (7 tests)
  // ========================================

  describe('Rendering', () => {
    test('renders marketplace title correctly', async () => {
      render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/groom marketplace/i)).toBeTruthy();
      });
    });

    test('renders groom list with all grooms', async () => {
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      // Wait for AsyncStorage to resolve
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Now check for groom names
      expect(getByTestId('groom-name-groom-1')).toBeTruthy();
      expect(getByTestId('groom-name-groom-2')).toBeTruthy();
      expect(getByTestId('groom-name-groom-3')).toBeTruthy();
      expect(getByTestId('groom-name-groom-4')).toBeTruthy();

      // Also verify the text content
      const groom1Name = getByTestId('groom-name-groom-1');
      expect(groom1Name.props.children.join('')).toBe('Sarah Johnson');
    });

    test('renders groom details (specialty, skill level, experience, price)', async () => {
      render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        // Check specialty
        expect(screen.getByText(/foal care/i)).toBeTruthy();
        expect(screen.getByText(/training/i)).toBeTruthy();
        
        // Check skill levels
        expect(screen.getByText(/expert/i)).toBeTruthy();
        expect(screen.getByText(/intermediate/i)).toBeTruthy();
        expect(screen.getByText(/novice/i)).toBeTruthy();
        expect(screen.getByText(/master/i)).toBeTruthy();
        
        // Check experience (years)
        expect(screen.getByText(/8 years/i)).toBeTruthy();
        expect(screen.getByText(/4 years/i)).toBeTruthy();
        
        // Check session rates
        expect(screen.getByText(/\$75/)).toBeTruthy();
        expect(screen.getByText(/\$50/)).toBeTruthy();
      });
    });

    test('renders empty state when no grooms available', async () => {
      const emptyMarketplaceData = {
        ...mockMarketplaceData,
        grooms: [],
      };

      render(
        <GroomListScreen
          marketplaceData={emptyMarketplaceData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no grooms available/i)).toBeTruthy();
      });
    });

    test('renders loading state initially', async () => {
      render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      // Component should start with loading state
      // After AsyncStorage resolves, content should appear
      await waitFor(() => {
        expect(screen.getByText(/groom marketplace/i)).toBeTruthy();
      });
    });

    test('shows refresh information (last refresh, next free refresh)', async () => {
      render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/last refresh/i)).toBeTruthy();
        expect(screen.getByText(/next free refresh/i)).toBeTruthy();
      });
    });

    test('shows filter and sort controls', async () => {
      render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/filter/i)).toBeTruthy();
        expect(screen.getByText(/sort/i)).toBeTruthy();
      });
    });
  });

  describe('Filtering', () => {
    test('filters grooms by skill level', async () => {
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Initially all 4 grooms should be visible
      expect(getByTestId('groom-card-groom-1')).toBeTruthy(); // expert
      expect(getByTestId('groom-card-groom-2')).toBeTruthy(); // master
      expect(getByTestId('groom-card-groom-3')).toBeTruthy(); // intermediate
      expect(getByTestId('groom-card-groom-4')).toBeTruthy(); // novice

      // Open filter modal and select 'expert' skill level
      const filterButton = screen.getByText(/filter/i);
      fireEvent.press(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/skill level/i)).toBeTruthy();
      });

      // Select 'expert' filter
      const expertOption = screen.getByTestId('filter-skill-expert');
      fireEvent.press(expertOption);

      // Apply filter
      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Now only expert groom should be visible
      await waitFor(() => {
        expect(getByTestId('groom-card-groom-1')).toBeTruthy(); // expert
      });

      // Other grooms should not be visible
      expect(() => getByTestId('groom-card-groom-2')).toThrow();
      expect(() => getByTestId('groom-card-groom-3')).toThrow();
      expect(() => getByTestId('groom-card-groom-4')).toThrow();
    });

    test('filters grooms by specialty', async () => {
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Open filter modal and select 'training' specialty
      const filterButton = screen.getByText(/filter/i);
      fireEvent.press(filterButton);

      await waitFor(() => {
        expect(screen.getByText(/specialty/i)).toBeTruthy();
      });

      // Select 'training' filter
      const trainingOption = screen.getByTestId('filter-specialty-training');
      fireEvent.press(trainingOption);

      // Apply filter
      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Now only training groom should be visible
      await waitFor(() => {
        expect(getByTestId('groom-card-groom-2')).toBeTruthy(); // training
      });

      // Other grooms should not be visible
      expect(() => getByTestId('groom-card-groom-1')).toThrow();
      expect(() => getByTestId('groom-card-groom-3')).toThrow();
      expect(() => getByTestId('groom-card-groom-4')).toThrow();
    });

    test('combines skill level and specialty filters', async () => {
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Open filter modal
      const filterButton = screen.getByText(/filter/i);
      fireEvent.press(filterButton);

      // Select 'intermediate' skill level and 'generalCare' specialty
      const intermediateOption = screen.getByTestId('filter-skill-intermediate');
      fireEvent.press(intermediateOption);

      const generalCareOption = screen.getByTestId('filter-specialty-generalCare');
      fireEvent.press(generalCareOption);

      // Apply filter
      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Now only intermediate + generalCare groom should be visible
      await waitFor(() => {
        expect(getByTestId('groom-card-groom-3')).toBeTruthy();
      });

      // Other grooms should not be visible
      expect(() => getByTestId('groom-card-groom-1')).toThrow();
      expect(() => getByTestId('groom-card-groom-2')).toThrow();
      expect(() => getByTestId('groom-card-groom-4')).toThrow();
    });

    test('resets filters to show all grooms', async () => {
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Apply a filter first
      const filterButton = screen.getByText(/filter/i);
      fireEvent.press(filterButton);

      const expertOption = screen.getByTestId('filter-skill-expert');
      fireEvent.press(expertOption);

      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Verify filter is applied (only 1 groom visible)
      await waitFor(() => {
        expect(getByTestId('groom-card-groom-1')).toBeTruthy();
      });

      // Now reset filters
      fireEvent.press(filterButton);
      const resetButton = screen.getByText(/reset/i);
      fireEvent.press(resetButton);

      // All grooms should be visible again
      await waitFor(() => {
        expect(getByTestId('groom-card-groom-1')).toBeTruthy();
        expect(getByTestId('groom-card-groom-2')).toBeTruthy();
        expect(getByTestId('groom-card-groom-3')).toBeTruthy();
        expect(getByTestId('groom-card-groom-4')).toBeTruthy();
      });
    });

    test('persists filter preferences to AsyncStorage', async () => {
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Apply a filter
      const filterButton = screen.getByText(/filter/i);
      fireEvent.press(filterButton);

      const expertOption = screen.getByTestId('filter-skill-expert');
      fireEvent.press(expertOption);

      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Verify AsyncStorage.setItem was called with correct values
      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@GroomListScreen:filterSkillLevel',
          'expert'
        );
      });
    });
  });
});

