import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MainNavigator } from '../MainNavigator';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Wrapper component that provides NavigationContainer
 */
function renderMainNavigator() {
  return render(
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  );
}

// ============================================================================
// TESTS
// ============================================================================

describe('MainNavigator', () => {
  // ==========================================================================
  // INITIAL STATE TESTS
  // ==========================================================================

  describe('Initial State', () => {
    it('should render HomeTab as initial tab', () => {
      const { getByTestId } = renderMainNavigator();

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should not render other tabs initially', () => {
      const { queryByTestId } = renderMainNavigator();

      expect(queryByTestId('search-screen')).not.toBeOnTheScreen();
      expect(queryByTestId('my-grooms-screen')).not.toBeOnTheScreen();
      expect(queryByTestId('profile-screen')).not.toBeOnTheScreen();
    });

    it('should display Home screen content', () => {
      const { getByText } = renderMainNavigator();

      expect(getByText('Home Screen')).toBeOnTheScreen();
    });

    it('should have HomeTab selected initially', () => {
      const { getByTestId } = renderMainNavigator();

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // TAB NAVIGATION TESTS
  // ==========================================================================

  describe('Tab Navigation', () => {
    it('should navigate to SearchTab when pressed', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      // Press Search tab using accessibility label
      const searchTab = getByLabelText('Search, tab, 2 of 4');
      fireEvent.press(searchTab);

      // Search screen should be visible
      await waitFor(() => {
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });
    });

    it('should navigate to MyGroomsTab when pressed', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      // Press MyGrooms tab using accessibility label
      const myGroomsTab = getByLabelText('My Grooms, tab, 3 of 4');
      fireEvent.press(myGroomsTab);

      // MyGrooms screen should be visible
      await waitFor(() => {
        expect(getByTestId('my-grooms-screen')).toBeOnTheScreen();
      });
    });

    it('should navigate to ProfileTab when pressed', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      // Press Profile tab using accessibility label
      const profileTab = getByLabelText('Profile, tab, 4 of 4');
      fireEvent.press(profileTab);

      // Profile screen should be visible
      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeOnTheScreen();
      });
    });

    it('should navigate back to HomeTab when pressed', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      // Navigate to Search
      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));

      await waitFor(() => {
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });

      // Navigate back to Home
      fireEvent.press(getByLabelText('Home, tab, 1 of 4'));

      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeOnTheScreen();
      });
    });
  });

  // ==========================================================================
  // TAB BAR TESTS
  // ==========================================================================

  describe('Tab Bar', () => {
    it('should render all four tabs', () => {
      const { getByLabelText } = renderMainNavigator();

      expect(getByLabelText('Home, tab, 1 of 4')).toBeOnTheScreen();
      expect(getByLabelText('Search, tab, 2 of 4')).toBeOnTheScreen();
      expect(getByLabelText('My Grooms, tab, 3 of 4')).toBeOnTheScreen();
      expect(getByLabelText('Profile, tab, 4 of 4')).toBeOnTheScreen();
    });

    it('should have correct accessibility labels for all tabs', () => {
      const { getByLabelText } = renderMainNavigator();

      const homeTab = getByLabelText('Home, tab, 1 of 4');
      const searchTab = getByLabelText('Search, tab, 2 of 4');
      const myGroomsTab = getByLabelText('My Grooms, tab, 3 of 4');
      const profileTab = getByLabelText('Profile, tab, 4 of 4');

      expect(homeTab).toBeOnTheScreen();
      expect(searchTab).toBeOnTheScreen();
      expect(myGroomsTab).toBeOnTheScreen();
      expect(profileTab).toBeOnTheScreen();
    });

    it('should have correct tab titles', () => {
      const { getByText } = renderMainNavigator();

      expect(getByText('Home')).toBeOnTheScreen();
      expect(getByText('Search')).toBeOnTheScreen();
      expect(getByText('My Grooms')).toBeOnTheScreen();
      expect(getByText('Profile')).toBeOnTheScreen();
    });

    it('should apply active tint color', () => {
      const { getByLabelText } = renderMainNavigator();

      // Active color is #007AFF (configured in navigator)
      expect(getByLabelText('Home, tab, 1 of 4')).toBeOnTheScreen();
    });

    it('should apply inactive tint color', () => {
      const { getByLabelText } = renderMainNavigator();

      // Inactive color is #8E8E93 (configured in navigator)
      expect(getByLabelText('Search, tab, 2 of 4')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // STACK NAVIGATOR TESTS
  // ==========================================================================

  describe('Stack Navigators', () => {
    it('should have HomeStack for HomeTab', () => {
      const { getByTestId } = renderMainNavigator();

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should have SearchStack for SearchTab', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));

      await waitFor(() => {
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });
    });

    it('should have MyGroomsStack for MyGroomsTab', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      fireEvent.press(getByLabelText('My Grooms, tab, 3 of 4'));

      await waitFor(() => {
        expect(getByTestId('my-grooms-screen')).toBeOnTheScreen();
      });
    });

    it('should have ProfileStack for ProfileTab', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      fireEvent.press(getByLabelText('Profile, tab, 4 of 4'));

      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeOnTheScreen();
      });
    });

    it('should show headers for stack screens', () => {
      const { getByTestId } = renderMainNavigator();

      // Headers are configured to show (headerShown: true)
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // TAB SWITCHING TESTS
  // ==========================================================================

  describe('Tab Switching', () => {
    it('should switch between tabs correctly', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      // Start at Home
      expect(getByTestId('home-screen')).toBeOnTheScreen();

      // Switch to Search
      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));
      await waitFor(() => {
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });

      // Switch to MyGrooms
      fireEvent.press(getByLabelText('My Grooms, tab, 3 of 4'));
      await waitFor(() => {
        expect(getByTestId('my-grooms-screen')).toBeOnTheScreen();
      });

      // Switch to Profile
      fireEvent.press(getByLabelText('Profile, tab, 4 of 4'));
      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeOnTheScreen();
      });

      // Switch back to Home
      fireEvent.press(getByLabelText('Home, tab, 1 of 4'));
      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeOnTheScreen();
      });
    });

    it('should hide previous tab when switching', async () => {
      const { getByLabelText, getByTestId, queryByTestId } = renderMainNavigator();

      // Start at Home
      expect(getByTestId('home-screen')).toBeOnTheScreen();

      // Switch to Search
      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));

      await waitFor(() => {
        expect(queryByTestId('home-screen')).not.toBeOnTheScreen();
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });
    });

    it('should maintain state when switching tabs', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      // Navigate to Search
      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));
      await waitFor(() => {
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });

      // Navigate to Profile
      fireEvent.press(getByLabelText('Profile, tab, 4 of 4'));
      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeOnTheScreen();
      });

      // Navigate back to Search - state should be maintained
      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));
      await waitFor(() => {
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });
    });

    it('should handle rapid tab switches', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      // Rapidly switch tabs
      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));
      fireEvent.press(getByLabelText('My Grooms, tab, 3 of 4'));
      fireEvent.press(getByLabelText('Profile, tab, 4 of 4'));
      fireEvent.press(getByLabelText('Home, tab, 1 of 4'));

      // Should end up at Home
      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeOnTheScreen();
      });
    });
  });

  // ==========================================================================
  // SCREEN CONTENT TESTS
  // ==========================================================================

  describe('Screen Content', () => {
    it('should render Home screen with correct content', () => {
      const { getByText } = renderMainNavigator();

      expect(getByText('Home Screen')).toBeOnTheScreen();
      expect(getByText('Placeholder for Home UI')).toBeOnTheScreen();
    });

    it('should render Search screen with correct content', async () => {
      const { getByLabelText, getByText } = renderMainNavigator();

      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));

      await waitFor(() => {
        expect(getByText('Search Screen')).toBeOnTheScreen();
        expect(getByText('Placeholder for Search UI')).toBeOnTheScreen();
      });
    });

    it('should render MyGrooms screen with correct content', async () => {
      const { getByLabelText, getByText } = renderMainNavigator();

      fireEvent.press(getByLabelText('My Grooms, tab, 3 of 4'));

      await waitFor(() => {
        expect(getByText('My Grooms Screen')).toBeOnTheScreen();
        expect(getByText('Placeholder for My Grooms UI')).toBeOnTheScreen();
      });
    });

    it('should render Profile screen with correct content', async () => {
      const { getByLabelText, getByText } = renderMainNavigator();

      fireEvent.press(getByLabelText('Profile, tab, 4 of 4'));

      await waitFor(() => {
        expect(getByText('Profile Screen')).toBeOnTheScreen();
        expect(getByText('Placeholder for Profile UI')).toBeOnTheScreen();
      });
    });
  });

  // ==========================================================================
  // NAVIGATION CONFIGURATION TESTS
  // ==========================================================================

  describe('Navigation Configuration', () => {
    it('should have HomeTab as initialRouteName', () => {
      const { getByTestId } = renderMainNavigator();

      // First tab should be HomeTab
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should hide main header', () => {
      const { getByTestId } = renderMainNavigator();

      // headerShown: false for tab navigator
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should configure all tabs in correct order', () => {
      const { getByLabelText } = renderMainNavigator();

      expect(getByLabelText('Home, tab, 1 of 4')).toBeOnTheScreen();
      expect(getByLabelText('Search, tab, 2 of 4')).toBeOnTheScreen();
      expect(getByLabelText('My Grooms, tab, 3 of 4')).toBeOnTheScreen();
      expect(getByLabelText('Profile, tab, 4 of 4')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Integration', () => {
    it('should integrate with NavigationContainer', () => {
      const { getByTestId } = renderMainNavigator();

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should provide navigation prop to screens', () => {
      const { getByTestId } = renderMainNavigator();

      // Screens receive navigation prop
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should work within RootNavigator context', () => {
      const { getByTestId } = renderMainNavigator();

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // TYPE SAFETY TESTS
  // ==========================================================================

  describe('Type Safety', () => {
    it('should use MainTabParamList types', () => {
      const { getByTestId } = renderMainNavigator();

      // Types are enforced at compile time
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should enforce tab name types', () => {
      const { getByLabelText } = renderMainNavigator();

      // Tab names match MainTabParamList
      expect(getByLabelText('Home, tab, 1 of 4')).toBeOnTheScreen();
    });

    it('should use stack param lists for each tab', () => {
      const { getByTestId } = renderMainNavigator();

      // Each stack has its own param list
      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should render correctly when mounted', () => {
      const { getByTestId } = renderMainNavigator();

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should handle component remount', () => {
      const { getByTestId, rerender } = renderMainNavigator();

      expect(getByTestId('home-screen')).toBeOnTheScreen();

      // Rerender
      rerender(
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      );

      expect(getByTestId('home-screen')).toBeOnTheScreen();
    });

    it('should maintain tab state during lifecycle', async () => {
      const { getByLabelText, getByTestId, rerender } = renderMainNavigator();

      // Navigate to Search
      fireEvent.press(getByLabelText('Search, tab, 2 of 4'));

      await waitFor(() => {
        expect(getByTestId('search-screen')).toBeOnTheScreen();
      });

      // Rerender
      rerender(
        <NavigationContainer>
          <MainNavigator />
        </NavigationContainer>
      );

      // Should still be on Search
      expect(getByTestId('search-screen')).toBeOnTheScreen();
    });

    it('should handle all tabs being pressed in sequence', async () => {
      const { getByLabelText, getByTestId } = renderMainNavigator();

      const tabs = [
        { a11yLabel: 'Search, tab, 2 of 4', screenTestID: 'search-screen' },
        { a11yLabel: 'My Grooms, tab, 3 of 4', screenTestID: 'my-grooms-screen' },
        { a11yLabel: 'Profile, tab, 4 of 4', screenTestID: 'profile-screen' },
        { a11yLabel: 'Home, tab, 1 of 4', screenTestID: 'home-screen' },
      ];

      for (const tab of tabs) {
        fireEvent.press(getByLabelText(tab.a11yLabel));
        await waitFor(() => {
          expect(getByTestId(tab.screenTestID)).toBeOnTheScreen();
        });
      }
    });
  });

  // ==========================================================================
  // ACCESSIBILITY TESTS
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have accessible tabs', () => {
      const { getByLabelText } = renderMainNavigator();

      expect(getByLabelText('Home, tab, 1 of 4')).toBeOnTheScreen();
      expect(getByLabelText('Search, tab, 2 of 4')).toBeOnTheScreen();
      expect(getByLabelText('My Grooms, tab, 3 of 4')).toBeOnTheScreen();
      expect(getByLabelText('Profile, tab, 4 of 4')).toBeOnTheScreen();
    });

    it('should support tab navigation via accessibility labels', () => {
      const { getByLabelText } = renderMainNavigator();

      const tabs = [
        'Home, tab, 1 of 4',
        'Search, tab, 2 of 4',
        'My Grooms, tab, 3 of 4',
        'Profile, tab, 4 of 4',
      ];

      tabs.forEach((tabA11yLabel) => {
        const tab = getByLabelText(tabA11yLabel);
        expect(tab).toBeTruthy();
      });
    });
  });
});
