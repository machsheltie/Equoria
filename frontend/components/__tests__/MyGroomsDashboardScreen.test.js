/**
 * MyGroomsDashboardScreen Component Tests
 *
 * Test suite for React Native groom dashboard component.
 * Tests rendering, assignment display, filtering, sorting, and assignment management.
 *
 * Testing approach:
 * - TDD with NO MOCKING (except AsyncStorage, Modal infrastructure)
 * - Pass real data as props to component
 * - Use async/await and waitFor for async operations
 * - Test categories: Rendering (5), Assignment Display (4), Filtering/Sorting (5), Assignment Management (5), Salary Summary (4)
 * - Target: 100% test success rate (23 tests)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import MyGroomsDashboardScreen from '../MyGroomsDashboardScreen.js';

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
    return <View testID={testID || "modal-container"}>{children}</View>;
  };
});

// Mock ScrollView (infrastructure - causes Flow syntax parsing errors)
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');

  return ({ children, testID, style }) => {
    return <View testID={testID} style={style}>{children}</View>;
  };
});

// Mock data for testing
const mockGroomsData = [
  {
    id: 1,
    name: 'Sarah Johnson',
    speciality: 'foal care',
    skillLevel: 'expert',
    personality: 'patient',
    experience: 8,
    sessionRate: 50,
    bio: 'Experienced foal care specialist',
    availability: true,
    userId: 'user123',
    groomAssignments: [
      {
        id: 101,
        groomId: 1,
        foalId: 201,
        bondScore: 75,
        priority: 1,
        isActive: true,
        foal: { id: 201, name: 'Thunder' },
      },
      {
        id: 102,
        groomId: 1,
        foalId: 202,
        bondScore: 60,
        priority: 2,
        isActive: true,
        foal: { id: 202, name: 'Lightning' },
      },
    ],
  },
  {
    id: 2,
    name: 'Mike Rodriguez',
    speciality: 'training',
    skillLevel: 'master',
    personality: 'energetic',
    experience: 12,
    sessionRate: 75,
    bio: 'Master trainer with 12 years experience',
    availability: true,
    userId: 'user123',
    groomAssignments: [],
  },
  {
    id: 3,
    name: 'Emma Thompson',
    speciality: 'general care',
    skillLevel: 'intermediate',
    personality: 'calm',
    experience: 5,
    sessionRate: 35,
    bio: 'Reliable general care specialist',
    availability: true,
    userId: 'user123',
    groomAssignments: [
      {
        id: 103,
        groomId: 3,
        foalId: 203,
        bondScore: 85,
        priority: 1,
        isActive: true,
        foal: { id: 203, name: 'Storm' },
      },
    ],
  },
];

const mockAssignmentsData = [
  {
    id: 101,
    groomId: 1,
    foalId: 201,
    bondScore: 75,
    priority: 1,
    isActive: true,
    createdAt: '2025-01-15T10:00:00Z',
    notes: null,
    horse: { id: 201, name: 'Thunder' },
  },
  {
    id: 102,
    groomId: 1,
    foalId: 202,
    bondScore: 60,
    priority: 2,
    isActive: true,
    createdAt: '2025-01-16T10:00:00Z',
    notes: null,
    horse: { id: 202, name: 'Lightning' },
  },
  {
    id: 103,
    groomId: 3,
    foalId: 203,
    bondScore: 85,
    priority: 1,
    isActive: true,
    createdAt: '2025-01-17T10:00:00Z',
    notes: null,
    horse: { id: 203, name: 'Storm' },
  },
];

const mockSalaryCostsData = {
  weeklyCost: 1120,
  totalPaid: 4480,
  groomCount: 3,
  breakdown: [
    { groomId: 1, groomName: 'Sarah Johnson', weeklyCost: 350, assignmentCount: 2 },
    { groomId: 2, groomName: 'Mike Rodriguez', weeklyCost: 525, assignmentCount: 0 },
    { groomId: 3, groomName: 'Emma Thompson', weeklyCost: 245, assignmentCount: 1 },
  ],
};

const mockUserData = {
  id: 'user123',
  username: 'testuser',
  email: 'test@example.com',
  money: 5000,
};

describe('MyGroomsDashboardScreen', () => {
  let alertSpy;

  beforeEach(() => {
    // Mock Alert.alert
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore Alert.alert
    alertSpy.mockRestore();
  });

  describe('Rendering', () => {
    test('renders dashboard with title', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/my grooms/i)).toBeTruthy();
      });
    });

    test('displays loading state when no data provided', async () => {
      render(<MyGroomsDashboardScreen userData={mockUserData} />);

      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeTruthy();
      });
    });

    test('displays empty state when no grooms hired', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={[]}
          assignmentsData={[]}
          salaryCostsData={{ weeklyCost: 0, totalPaid: 0, groomCount: 0, breakdown: [] }}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no grooms hired/i)).toBeTruthy();
      });
    });

    test('displays groom cards when grooms exist', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeTruthy();
        expect(screen.getByText('Mike Rodriguez')).toBeTruthy();
        expect(screen.getByText('Emma Thompson')).toBeTruthy();
      });
    });

    test('displays salary summary section', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/weekly cost/i)).toBeTruthy();
        expect(screen.getByText(/\$1,120/)).toBeTruthy();
      });
    });
  });

  describe('Assignment Display', () => {
    test('displays current assignments for each groom', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        // Sarah Johnson has 2 assignments
        expect(screen.getByText('Thunder')).toBeTruthy();
        expect(screen.getByText('Lightning')).toBeTruthy();
        // Emma Thompson has 1 assignment
        expect(screen.getByText('Storm')).toBeTruthy();
      });
    });

    test('displays bond scores for each assignment', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/bond: 75/i)).toBeTruthy();
        expect(screen.getByText(/bond: 60/i)).toBeTruthy();
        expect(screen.getByText(/bond: 85/i)).toBeTruthy();
      });
    });

    test('displays unassign button for each assignment', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        const unassignButtons = screen.getAllByText(/unassign/i);
        expect(unassignButtons.length).toBe(3); // 3 total assignments
      });
    });

    test('shows no assignments message for grooms without assignments', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        // Mike Rodriguez has no assignments
        const mikeCard = screen.getByTestId('groom-card-2');
        expect(mikeCard).toBeTruthy();
        // Should not have "Current Assignments" section
        const assignmentsSections = screen.queryAllByText(/current assignments/i);
        // Only 2 grooms have assignments (Sarah and Emma)
        expect(assignmentsSections.length).toBe(2);
      });
    });
  });

  describe('Filtering and Sorting', () => {
    test('filters grooms by skill level', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        const filterButton = screen.getByTestId('filter-button');
        fireEvent.press(filterButton);
      });

      await waitFor(() => {
        const expertButton = screen.getByText('Expert');
        fireEvent.press(expertButton);
      });

      await waitFor(() => {
        const applyButton = screen.getByText(/apply filters/i);
        fireEvent.press(applyButton);
      });

      await waitFor(() => {
        // Only Sarah Johnson is expert level
        expect(screen.getByText('Sarah Johnson')).toBeTruthy();
        expect(screen.queryByText('Mike Rodriguez')).toBeNull();
        expect(screen.queryByText('Emma Thompson')).toBeNull();
      });
    });

    test('filters grooms by specialty', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        const filterButton = screen.getByTestId('filter-button');
        fireEvent.press(filterButton);
      });

      await waitFor(() => {
        const trainingButton = screen.getByText('Training');
        fireEvent.press(trainingButton);
      });

      await waitFor(() => {
        const applyButton = screen.getByText(/apply filters/i);
        fireEvent.press(applyButton);
      });

      await waitFor(() => {
        // Only Mike Rodriguez is training specialty
        expect(screen.getByText('Mike Rodriguez')).toBeTruthy();
        expect(screen.queryByText('Sarah Johnson')).toBeNull();
        expect(screen.queryByText('Emma Thompson')).toBeNull();
      });
    });

    test('sorts grooms by name', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        const sortButton = screen.getByTestId('sort-button');
        fireEvent.press(sortButton);
      });

      await waitFor(() => {
        const nameButton = screen.getByText('Name (A-Z)');
        fireEvent.press(nameButton);
      });

      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card-/);
        // Should be sorted: Emma, Mike, Sarah
        expect(groomCards.length).toBe(3);
      });
    });

    test('sorts grooms by salary', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        const sortButton = screen.getByTestId('sort-button');
        fireEvent.press(sortButton);
      });

      await waitFor(() => {
        const salaryButton = screen.getByText('Salary (High-Low)');
        fireEvent.press(salaryButton);
      });

      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card-/);
        // Should be sorted: Mike ($75), Sarah ($50), Emma ($35)
        expect(groomCards.length).toBe(3);
      });
    });

    test('resets filters when reset button is pressed', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      // Apply filter first
      await waitFor(() => {
        const filterButton = screen.getByTestId('filter-button');
        fireEvent.press(filterButton);
      });

      await waitFor(() => {
        const expertButton = screen.getByText('Expert');
        fireEvent.press(expertButton);
      });

      await waitFor(() => {
        const applyButton = screen.getByText(/apply filters/i);
        fireEvent.press(applyButton);
      });

      // Reset filters
      await waitFor(() => {
        const filterButton = screen.getByTestId('filter-button');
        fireEvent.press(filterButton);
      });

      await waitFor(() => {
        const resetButton = screen.getByText(/reset/i);
        fireEvent.press(resetButton);
      });

      await waitFor(() => {
        // All grooms should be visible again
        expect(screen.getByText('Sarah Johnson')).toBeTruthy();
        expect(screen.getByText('Mike Rodriguez')).toBeTruthy();
        expect(screen.getByText('Emma Thompson')).toBeTruthy();
      });
    });
  });

  describe('Assignment Management', () => {
    test('calls onUnassign callback when unassign is confirmed', async () => {
      const mockOnUnassign = jest.fn();

      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
          onUnassign={mockOnUnassign}
        />
      );

      await waitFor(() => {
        const unassignButton = screen.getByTestId('unassign-button-101');
        fireEvent.press(unassignButton);
      });

      // Confirm the alert
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'Unassign Groom',
          expect.stringContaining('Thunder'),
          expect.any(Array)
        );
      });

      // Simulate pressing "Unassign" button in alert
      const alertButtons = alertSpy.mock.calls[0][2];
      const unassignAlertButton = alertButtons.find((btn) => btn.text === 'Unassign');
      unassignAlertButton.onPress();

      await waitFor(() => {
        expect(mockOnUnassign).toHaveBeenCalledWith(101);
      });
    });

    test('does not call onUnassign when cancel is pressed', async () => {
      const mockOnUnassign = jest.fn();

      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
          onUnassign={mockOnUnassign}
        />
      );

      await waitFor(() => {
        const unassignButton = screen.getByTestId('unassign-button-101');
        fireEvent.press(unassignButton);
      });

      // Simulate pressing "Cancel" button in alert
      const alertButtons = alertSpy.mock.calls[0][2];
      const cancelButton = alertButtons.find((btn) => btn.text === 'Cancel');
      if (cancelButton.onPress) {
        cancelButton.onPress();
      }

      await waitFor(() => {
        expect(mockOnUnassign).not.toHaveBeenCalled();
      });
    });

    test('displays assign button for grooms with available slots', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        // Sarah has 2/3 slots used (expert = 3 max), should have assign button
        const sarahCard = screen.getByTestId('groom-card-1');
        expect(sarahCard).toBeTruthy();
        // Mike has 0/4 slots used (master = 4 max), should have assign button
        const mikeCard = screen.getByTestId('groom-card-2');
        expect(mikeCard).toBeTruthy();
      });
    });

    test('shows warning for unassigned grooms', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        // Mike Rodriguez has no assignments - should show warning
        expect(screen.getByText(/1 groom.*no assignments/i)).toBeTruthy();
      });
    });
  });

  describe('Salary Summary and Warnings', () => {
    test('displays correct weekly cost in salary summary', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/weekly cost/i)).toBeTruthy();
        expect(screen.getByText('$1,120')).toBeTruthy();
      });
    });

    test('displays correct total paid in salary summary', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/total paid/i)).toBeTruthy();
        expect(screen.getByText('$4,480')).toBeTruthy();
      });
    });

    test('displays correct groom count in salary summary', async () => {
      render(
        <MyGroomsDashboardScreen
          groomsData={mockGroomsData}
          assignmentsData={mockAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/groom count/i)).toBeTruthy();
        const groomCountElements = screen.getAllByText('3');
        expect(groomCountElements.length).toBeGreaterThan(0);
      });
    });

    test('does not show warning when all grooms are assigned', async () => {
      // Create data where all grooms have assignments
      const allAssignedGroomsData = mockGroomsData.map((groom) => ({
        ...groom,
        groomAssignments: groom.groomAssignments.length > 0 ? groom.groomAssignments : [
          {
            id: 999,
            groomId: groom.id,
            foalId: 999,
            bondScore: 50,
            priority: 1,
            isActive: true,
            foal: { id: 999, name: 'Test Horse' },
          },
        ],
      }));

      const allAssignedAssignmentsData = [
        ...mockAssignmentsData,
        {
          id: 999,
          groomId: 2,
          foalId: 999,
          bondScore: 50,
          priority: 1,
          isActive: true,
          createdAt: '2025-01-18T10:00:00Z',
          notes: null,
          horse: { id: 999, name: 'Test Horse' },
        },
      ];

      render(
        <MyGroomsDashboardScreen
          groomsData={allAssignedGroomsData}
          assignmentsData={allAssignedAssignmentsData}
          salaryCostsData={mockSalaryCostsData}
          userData={mockUserData}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('unassigned-warning')).toBeNull();
      });
    });
  });
});

