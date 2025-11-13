import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector } from '@state/hooks';
import type { RootStackParamList } from './types';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * LoadingScreen - Displayed while checking auth state from persisted storage
 */
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer} testID="loading-screen">
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

/**
 * RootNavigator - Top-level navigator
 *
 * Switches between Auth and Main based on Redux auth state:
 * - isLoading: true -> Shows loading screen
 * - isAuthenticated: false -> Shows AuthNavigator (Login, Register, etc.)
 * - isAuthenticated: true -> Shows MainNavigator (Home tabs)
 */
function RootNavigatorScreens() {
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // Show loading screen while rehydrating persisted state
  if (isLoading) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Auth" component={LoadingScreen} />
      </Stack.Navigator>
    );
  }

  // Switch between Auth and Main based on authentication status
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

/**
 * RootNavigator - Wraps navigation in NavigationContainer
 * This is the component that should be rendered in App.tsx
 */
export function RootNavigator() {
  return (
    <NavigationContainer>
      <RootNavigatorScreens />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
