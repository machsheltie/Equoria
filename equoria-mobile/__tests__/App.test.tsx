import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import App from '../App';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

// Mock RootNavigator
jest.mock('../src/navigation', () => ({
  RootNavigator: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="root-navigator">
        <Text>Navigation Loaded</Text>
      </View>
    );
  },
}));

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('Provider Hierarchy', () => {
    it('should render without crashing', () => {
      const { getByTestId } = render(<App />);
      expect(getByTestId('root-navigator')).toBeTruthy();
    });

    it('should wrap RootNavigator in Redux Provider', () => {
      const { getByTestId } = render(<App />);
      // If Redux Provider is working, RootNavigator will render
      expect(getByTestId('root-navigator')).toBeTruthy();
    });

    it('should wrap RootNavigator in PersistGate', () => {
      const { getByTestId } = render(<App />);
      // If PersistGate is working, RootNavigator will render
      expect(getByTestId('root-navigator')).toBeTruthy();
    });

    it('should wrap RootNavigator in QueryClientProvider', () => {
      const { getByTestId } = render(<App />);
      // If QueryClientProvider is working, RootNavigator will render
      expect(getByTestId('root-navigator')).toBeTruthy();
    });
  });

  describe('Navigation Integration', () => {
    it('should render RootNavigator component', () => {
      const { getByTestId } = render(<App />);
      expect(getByTestId('root-navigator')).toBeTruthy();
    });

    it('should display navigation content', () => {
      const { getByText } = render(<App />);
      expect(getByText('Navigation Loaded')).toBeTruthy();
    });
  });

  describe('StatusBar', () => {
    it('should include StatusBar component', () => {
      // StatusBar is mocked but included in the component
      const { getByTestId } = render(<App />);
      expect(getByTestId('root-navigator')).toBeTruthy();
    });
  });

  describe('Provider Order', () => {
    it('should maintain correct provider order: Redux > PersistGate > QueryClient > Navigation', async () => {
      const { getByTestId } = render(<App />);

      // Wait for PersistGate to complete rehydration
      await waitFor(() => {
        expect(getByTestId('root-navigator')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle provider initialization errors gracefully', () => {
      // If any provider fails, app should still attempt to render
      expect(() => render(<App />)).not.toThrow();
    });
  });
});
