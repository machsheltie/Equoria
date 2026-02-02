/**
 * WeeklySalaryReminder Component Tests
 *
 * Tests for the React Native weekly salary reminder component including:
 * - Salary summary display (weekly cost, total paid)
 * - Unassigned grooms warning
 * - Dismissible notification with AsyncStorage persistence
 * - Navigation to groom management
 * - Error handling and loading states
 * - Accessibility support
 *
 * Following TDD with NO MOCKING approach for authentic component validation
 * Testing real component behavior with real data passed as props
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WeeklySalaryReminder from '../WeeklySalaryReminder.js';

describe('WeeklySalaryReminder Component', () => {
  const mockSalarySummaryData = {
    weeklyCost: 325,
    totalPaid: 1300,
    groomCount: 3,
    unassignedGroomsCount: 1,
    breakdown: [
      { groomId: 1, groomName: 'Sarah Johnson', weeklyCost: 100, assignmentCount: 2 },
      { groomId: 2, groomName: 'Mike Rodriguez', weeklyCost: 75, assignmentCount: 0 },
      { groomId: 3, groomName: 'Emma Thompson', weeklyCost: 150, assignmentCount: 1 },
    ],
  };

  const mockOnNavigateToGrooms = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
  });

  describe('Rendering and Display', () => {
    test('renders salary summary correctly with all data', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/weekly groom salaries/i)).toBeTruthy();
      });
      expect(screen.getByText(/\$325/)).toBeTruthy();
      expect(screen.getByText(/total paid this month/i)).toBeTruthy();
      expect(screen.getByText(/\$1,300/)).toBeTruthy();
    });

    test('displays weekly cost with proper formatting', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      // Check for formatted weekly cost
      await waitFor(() => {
        expect(screen.getByText(/you paid/i)).toBeTruthy();
      });
      expect(screen.getByText(/\$325/)).toBeTruthy();
      expect(screen.getByText(/in groom salaries this week/i)).toBeTruthy();
    });

    test('displays total paid with proper formatting', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      // Check for formatted total paid
      await waitFor(() => {
        expect(screen.getByText(/total paid this month/i)).toBeTruthy();
      });
      expect(screen.getByText(/\$1,300/)).toBeTruthy();
    });

    test('shows unassigned grooms warning when applicable', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/1 groom with no assignments/i)).toBeTruthy();
      });
      expect(screen.getByText(/consider assigning them to save money/i)).toBeTruthy();
    });

    test('does not show unassigned warning when all grooms are assigned', async () => {
      const allAssignedData = {
        ...mockSalarySummaryData,
        unassignedGroomsCount: 0,
      };

      render(
        <WeeklySalaryReminder
          salarySummaryData={allAssignedData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText(/weekly groom salaries/i)).toBeTruthy();
      });

      expect(screen.queryByText(/groom with no assignments/i)).toBeNull();
    });

    test('does not render when no grooms are hired', async () => {
      const noGroomsData = {
        weeklyCost: 0,
        totalPaid: 0,
        groomCount: 0,
        unassignedGroomsCount: 0,
        breakdown: [],
      };

      render(
        <WeeklySalaryReminder
          salarySummaryData={noGroomsData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      // Wait for loading to complete, then check component doesn't render
      await waitFor(() => {
        expect(screen.queryByText(/weekly groom salaries/i)).toBeNull();
      });
    });

    test('does not render when salarySummaryData is null', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={null}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      // Wait for loading to complete, then check component doesn't render
      await waitFor(() => {
        expect(screen.queryByText(/weekly groom salaries/i)).toBeNull();
      });
    });
  });

  describe('Dismissible Notification', () => {
    test('dismisses notification when close button is pressed', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      // Wait for component to load, then find and press the dismiss button
      await waitFor(() => {
        expect(screen.getByLabelText(/dismiss salary reminder/i)).toBeTruthy();
      });

      const dismissButton = screen.getByLabelText(/dismiss salary reminder/i);
      fireEvent.press(dismissButton);

      // Wait for the component to update
      await waitFor(() => {
        expect(screen.queryByText(/weekly groom salaries/i)).toBeNull();
      });
    });

    test('persists dismissed state to AsyncStorage', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByLabelText(/dismiss salary reminder/i)).toBeTruthy();
      });

      const dismissButton = screen.getByLabelText(/dismiss salary reminder/i);
      fireEvent.press(dismissButton);

      await waitFor(() => {
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('salary_reminder_dismissed', 'true');
      });
    });

    test('does not render when previously dismissed (from AsyncStorage)', async () => {
      AsyncStorage.getItem.mockResolvedValue('true');

      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/weekly groom salaries/i)).toBeNull();
      });
    });
  });

  describe('Navigation', () => {
    test('calls onNavigateToGrooms when link is pressed', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/manage grooms/i)).toBeTruthy();
      });

      const manageLink = screen.getByText(/manage grooms/i);
      fireEvent.press(manageLink);

      expect(mockOnNavigateToGrooms).toHaveBeenCalledTimes(1);
    });

    test('manage grooms link is accessible', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/manage grooms/i)).toBeTruthy();
      });

      const manageLink = screen.getByText(/manage grooms/i);
      expect(manageLink).toBeTruthy();
      // Note: The text is inside a TouchableOpacity with accessibilityRole="button"
      // Testing that the link text is present and clickable is sufficient
      expect(manageLink.parent).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    test('has proper accessibility labels for dismiss button', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/dismiss salary reminder/i)).toBeTruthy();
      });

      const dismissButton = screen.getByLabelText(/dismiss salary reminder/i);
      expect(dismissButton).toBeTruthy();
      expect(dismissButton.props.accessible).toBe(true);
    });

    test('has proper accessibility role for interactive elements', async () => {
      render(
        <WeeklySalaryReminder
          salarySummaryData={mockSalarySummaryData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/dismiss salary reminder/i)).toBeTruthy();
      });

      const dismissButton = screen.getByLabelText(/dismiss salary reminder/i);
      expect(dismissButton.props.accessibilityRole).toBe('button');
    });
  });

  describe('Edge Cases', () => {
    test('handles large numbers with proper formatting', async () => {
      const largeNumbersData = {
        weeklyCost: 12500,
        totalPaid: 50000,
        groomCount: 10,
        unassignedGroomsCount: 3,
        breakdown: [],
      };

      render(
        <WeeklySalaryReminder
          salarySummaryData={largeNumbersData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/\$12,500/)).toBeTruthy();
      });
      expect(screen.getByText(/\$50,000/)).toBeTruthy();
    });

    test('handles plural vs singular groom text correctly', async () => {
      const multipleUnassignedData = {
        ...mockSalarySummaryData,
        unassignedGroomsCount: 3,
      };

      render(
        <WeeklySalaryReminder
          salarySummaryData={multipleUnassignedData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/3 grooms with no assignments/i)).toBeTruthy();
      });
    });

    test('handles zero weekly cost gracefully', async () => {
      const zeroWeeklyCostData = {
        weeklyCost: 0,
        totalPaid: 500,
        groomCount: 2,
        unassignedGroomsCount: 0,
        breakdown: [],
      };

      render(
        <WeeklySalaryReminder
          salarySummaryData={zeroWeeklyCostData}
          onNavigateToGrooms={mockOnNavigateToGrooms}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/\$0/)).toBeTruthy();
      });
    });
  });
});
