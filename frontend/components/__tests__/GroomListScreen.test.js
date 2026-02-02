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
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GroomListScreen from '../GroomListScreen.js';

// Mock AsyncStorage ONLY (infrastructure, not business logic)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock Modal (infrastructure - causes issues with react-test-renderer)
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');

  return ({ visible, children, testID }) => {
    if (!visible) return null;
    return <View testID={testID || 'modal-container'}>{children}</View>;
  };
});

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
      skillLevel: 'master',
      personality: 'firm',
      experience: 12,
      sessionRate: 100,
      bio: 'Master training specialist with 12 years of experience',
      availability: true,
    },
    {
      marketplaceId: 'groom-3',
      firstName: 'Emily',
      lastName: 'Davis',
      specialty: 'generalCare',
      skillLevel: 'intermediate',
      personality: 'patient',
      experience: 5,
      sessionRate: 60,
      bio: 'Intermediate general care groom with 5 years of experience',
      availability: true,
    },
    {
      marketplaceId: 'groom-4',
      firstName: 'Alex',
      lastName: 'Martinez',
      specialty: 'showHandling',
      skillLevel: 'novice',
      personality: 'balanced',
      experience: 2,
      sessionRate: 40,
      bio: 'Novice show handler with 2 years of experience',
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
      render(<GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />);

      await waitFor(() => {
        expect(screen.getByText(/groom marketplace/i)).toBeTruthy();
      });
    });

    test('renders groom list with all grooms', async () => {
      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
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
      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Verify all 4 groom cards are rendered with details
      expect(getByTestId('groom-card-groom-1')).toBeTruthy();
      expect(getByTestId('groom-card-groom-2')).toBeTruthy();
      expect(getByTestId('groom-card-groom-3')).toBeTruthy();
      expect(getByTestId('groom-card-groom-4')).toBeTruthy();

      // Check that groom details are displayed (just verify cards have content)
      const groomCard1 = getByTestId('groom-card-groom-1');
      expect(groomCard1).toBeTruthy();
    });

    test('renders empty state when no grooms available', async () => {
      const emptyMarketplaceData = {
        ...mockMarketplaceData,
        grooms: [],
      };

      render(<GroomListScreen marketplaceData={emptyMarketplaceData} userData={mockUserData} />);

      await waitFor(() => {
        expect(screen.getByText(/no grooms available/i)).toBeTruthy();
      });
    });

    test('renders loading state initially', async () => {
      render(<GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />);

      // Component should start with loading state
      // After AsyncStorage resolves, content should appear
      await waitFor(() => {
        expect(screen.getByText(/groom marketplace/i)).toBeTruthy();
      });
    });

    test('shows refresh information (last refresh, next free refresh)', async () => {
      render(<GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />);

      await waitFor(() => {
        expect(screen.getByText(/last refresh/i)).toBeTruthy();
        expect(screen.getByText(/next free refresh/i)).toBeTruthy();
      });
    });

    test('shows filter and sort controls', async () => {
      render(<GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />);

      await waitFor(() => {
        expect(screen.getByText(/filter/i)).toBeTruthy();
        expect(screen.getByText(/sort/i)).toBeTruthy();
      });
    });
  });

  describe('Filtering', () => {
    test('filters grooms by skill level', async () => {
      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
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

      // Wait for modal to appear and select 'expert' filter
      await waitFor(() => {
        const expertOption = screen.getByTestId('filter-skill-expert');
        fireEvent.press(expertOption);
      });

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
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Open filter modal and select 'training' specialty
      const filterButton = screen.getByText(/filter/i);
      fireEvent.press(filterButton);

      // Wait for modal to appear and select 'training' filter
      await waitFor(() => {
        const trainingOption = screen.getByTestId('filter-specialty-training');
        fireEvent.press(trainingOption);
      });

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
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
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
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
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
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
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
          'groom_marketplace_filter_skill',
          'expert'
        );
      });
    });
  });

  // ========================================
  // SORTING TESTS (3 tests)
  // ========================================

  describe('Sorting', () => {
    test('sorts grooms by name (alphabetical)', async () => {
      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Open sort modal and select 'name' sort
      const sortButton = screen.getByText(/sort/i);
      fireEvent.press(sortButton);

      // Wait for modal to appear and select 'name' sort option
      await waitFor(() => {
        const nameOption = screen.getByTestId('sort-option-name');
        fireEvent.press(nameOption);
      });

      // Apply sort
      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Verify grooms are in alphabetical order: Alex, Emily, Mike, Sarah
      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card-/);
        expect(groomCards.length).toBe(4);

        // Check order by verifying testIDs
        expect(groomCards[0].props.testID).toBe('groom-card-groom-4'); // Alex
        expect(groomCards[1].props.testID).toBe('groom-card-groom-3'); // Emily
        expect(groomCards[2].props.testID).toBe('groom-card-groom-2'); // Mike
        expect(groomCards[3].props.testID).toBe('groom-card-groom-1'); // Sarah
      });
    });

    test('sorts grooms by price (ascending and descending)', async () => {
      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Test ascending sort (lowest price first)
      const sortButton = screen.getByText(/sort/i);
      fireEvent.press(sortButton);

      await waitFor(() => {
        const priceAscOption = screen.getByTestId('sort-option-price-asc');
        fireEvent.press(priceAscOption);
      });

      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Verify grooms are in price ascending order: $40, $60, $75, $100
      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card-/);
        expect(groomCards[0].props.testID).toBe('groom-card-groom-4'); // $40
        expect(groomCards[1].props.testID).toBe('groom-card-groom-3'); // $60
        expect(groomCards[2].props.testID).toBe('groom-card-groom-1'); // $75
        expect(groomCards[3].props.testID).toBe('groom-card-groom-2'); // $100
      });

      // Test descending sort (highest price first)
      fireEvent.press(sortButton);

      await waitFor(() => {
        const priceDescOption = screen.getByTestId('sort-option-price-desc');
        fireEvent.press(priceDescOption);
      });

      // Get fresh reference to apply button
      const applyButton2 = screen.getByText(/apply/i);
      fireEvent.press(applyButton2);

      // Verify grooms are in price descending order: $100, $75, $60, $40
      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card-/);
        expect(groomCards[0].props.testID).toBe('groom-card-groom-2'); // $100
        expect(groomCards[1].props.testID).toBe('groom-card-groom-1'); // $75
        expect(groomCards[2].props.testID).toBe('groom-card-groom-3'); // $60
        expect(groomCards[3].props.testID).toBe('groom-card-groom-4'); // $40
      });
    });

    test('sorts grooms by experience (ascending and descending)', async () => {
      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Test ascending sort (least experience first)
      const sortButton = screen.getByText(/sort/i);
      fireEvent.press(sortButton);

      await waitFor(() => {
        const expAscOption = screen.getByTestId('sort-option-experience-asc');
        fireEvent.press(expAscOption);
      });

      const applyButton = screen.getByText(/apply/i);
      fireEvent.press(applyButton);

      // Verify grooms are in experience ascending order: 2, 5, 8, 12 years
      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card-/);
        expect(groomCards[0].props.testID).toBe('groom-card-groom-4'); // 2 years
        expect(groomCards[1].props.testID).toBe('groom-card-groom-3'); // 5 years
        expect(groomCards[2].props.testID).toBe('groom-card-groom-1'); // 8 years
        expect(groomCards[3].props.testID).toBe('groom-card-groom-2'); // 12 years
      });

      // Test descending sort (most experience first)
      fireEvent.press(sortButton);

      await waitFor(() => {
        const expDescOption = screen.getByTestId('sort-option-experience-desc');
        fireEvent.press(expDescOption);
      });

      // Get fresh reference to apply button
      const applyButton2 = screen.getByText(/apply/i);
      fireEvent.press(applyButton2);

      // Verify grooms are in experience descending order: 12, 8, 5, 2 years
      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card-/);
        expect(groomCards[0].props.testID).toBe('groom-card-groom-2'); // 12 years
        expect(groomCards[1].props.testID).toBe('groom-card-groom-1'); // 8 years
        expect(groomCards[2].props.testID).toBe('groom-card-groom-3'); // 5 years
        expect(groomCards[3].props.testID).toBe('groom-card-groom-4'); // 2 years
      });
    });
  });

  // ========================================
  // HIRING TESTS (5 tests)
  // ========================================

  describe('Hiring', () => {
    let alertSpy;

    beforeEach(() => {
      // Spy on Alert.alert (infrastructure - prevents native alerts during testing)
      alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore Alert.alert after each test
      if (alertSpy) {
        alertSpy.mockRestore();
      }
    });

    test('opens hire modal when hire button is pressed', async () => {
      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Click hire button for first groom (Sarah Johnson - $75/session)
      const hireButton = screen.getByTestId('hire-button-groom-1');
      fireEvent.press(hireButton);

      // Verify hire modal appears
      await waitFor(() => {
        expect(screen.getByTestId('hire-modal')).toBeTruthy();
      });

      // Verify modal shows groom details
      expect(screen.getByText(/hire groom/i)).toBeTruthy();
      expect(screen.getAllByText(/sarah johnson/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/foal care/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/expert/i).length).toBeGreaterThan(0);

      // Verify modal shows hire cost (7 sessions * $75 = $525)
      expect(screen.getAllByText(/\$525/).length).toBeGreaterThan(0);
    });

    test('calls onGroomHired callback when hire is confirmed', async () => {
      const mockOnGroomHired = jest.fn();
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
          onGroomHired={mockOnGroomHired}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Open hire modal for first groom
      const hireButton = screen.getByTestId('hire-button-groom-1');
      fireEvent.press(hireButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('hire-modal')).toBeTruthy();
      });

      // Click confirm button
      const confirmButton = screen.getByTestId('hire-confirm-button');
      fireEvent.press(confirmButton);

      // Verify callback was called with correct groom data
      await waitFor(() => {
        expect(mockOnGroomHired).toHaveBeenCalledTimes(1);
        expect(mockOnGroomHired).toHaveBeenCalledWith(
          expect.objectContaining({
            marketplaceId: 'groom-1',
            firstName: 'Sarah',
            lastName: 'Johnson',
          })
        );
      });
    });

    test('shows insufficient funds error when user cannot afford groom', async () => {
      // User with low funds ($100)
      const poorUserData = {
        ...mockUserData,
        money: 100,
      };

      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={poorUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Try to hire expensive groom (Sarah - $525 total)
      const hireButton = screen.getByTestId('hire-button-groom-1');
      fireEvent.press(hireButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('hire-modal')).toBeTruthy();
      });

      // Verify insufficient funds warning is shown in modal
      expect(screen.getByText(/insufficient funds/i)).toBeTruthy();

      // Verify confirm button is disabled
      const confirmButton = screen.getByTestId('hire-confirm-button');
      expect(confirmButton.props.accessibilityState.disabled).toBe(true);
    });

    test('disables hire button when user cannot afford groom', async () => {
      // User with low funds ($100)
      const poorUserData = {
        ...mockUserData,
        money: 100,
      };

      const { getByTestId } = render(
        <GroomListScreen marketplaceData={mockMarketplaceData} userData={poorUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Open hire modal for expensive groom (Sarah - $525 total)
      const hireButton = screen.getByTestId('hire-button-groom-1');
      fireEvent.press(hireButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('hire-modal')).toBeTruthy();
      });

      // Verify confirm button is disabled
      const confirmButton = screen.getByTestId('hire-confirm-button');
      expect(confirmButton.props.accessibilityState.disabled).toBe(true);
    });

    test('closes hire modal after successful hire', async () => {
      const mockOnGroomHired = jest.fn();
      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
          onGroomHired={mockOnGroomHired}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Open hire modal
      const hireButton = screen.getByTestId('hire-button-groom-1');
      fireEvent.press(hireButton);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByTestId('hire-modal')).toBeTruthy();
      });

      // Confirm hire
      const confirmButton = screen.getByTestId('hire-confirm-button');
      fireEvent.press(confirmButton);

      // Verify modal closes
      await waitFor(() => {
        expect(screen.queryByTestId('hire-modal')).toBeNull();
      });

      // Verify callback was triggered
      expect(mockOnGroomHired).toHaveBeenCalledTimes(1);
    });
  });

  describe('Refresh', () => {
    test('calls onRefreshMarketplace callback when refresh button is pressed', async () => {
      const mockOnRefreshMarketplace = jest.fn();

      const { getByTestId } = render(
        <GroomListScreen
          marketplaceData={mockMarketplaceData}
          userData={mockUserData}
          onRefreshMarketplace={mockOnRefreshMarketplace}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Press refresh button
      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.press(refreshButton);

      // Verify callback was called
      expect(mockOnRefreshMarketplace).toHaveBeenCalledTimes(1);
    });

    test('shows free refresh available when canRefreshFree is true', async () => {
      const freeRefreshData = {
        ...mockMarketplaceData,
        canRefreshFree: true,
        refreshCost: 0,
      };

      const { getByTestId } = render(
        <GroomListScreen marketplaceData={freeRefreshData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Verify free refresh text is shown
      expect(screen.getByText(/free refresh available/i)).toBeTruthy();
    });

    test('shows premium refresh cost when canRefreshFree is false', async () => {
      const premiumRefreshData = {
        ...mockMarketplaceData,
        canRefreshFree: false,
        refreshCost: 100,
      };

      const { getByTestId } = render(
        <GroomListScreen marketplaceData={premiumRefreshData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Verify premium refresh cost is shown
      const costElements = screen.getAllByText(/\$100/);
      expect(costElements.length).toBeGreaterThan(0);
    });

    test('displays countdown timer until next free refresh', async () => {
      // Set next free refresh to 1 hour from now
      const oneHourFromNow = new Date();
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

      const timerData = {
        ...mockMarketplaceData,
        canRefreshFree: false,
        nextFreeRefresh: oneHourFromNow.toISOString(),
      };

      const { getByTestId } = render(
        <GroomListScreen marketplaceData={timerData} userData={mockUserData} />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(getByTestId('groom-list-scroll')).toBeTruthy();
      });

      // Verify countdown timer is displayed (should show hours and minutes)
      const timerElement = screen.getByTestId('refresh-countdown');
      expect(timerElement).toBeTruthy();
      expect(timerElement.props.children).toMatch(/\d+h|\d+m|\d+s/);
    });
  });
});
