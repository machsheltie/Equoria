import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { store, persistor } from './src/state/store';
import { queryClient } from './src/state/queryClient';
import { RootNavigator } from './src/navigation';

/**
 * App - Root component with all providers
 *
 * Provider hierarchy:
 * 1. Redux Provider - Global state management
 * 2. PersistGate - Waits for persisted state to rehydrate
 * 3. QueryClientProvider - React Query for API state
 * 4. RootNavigator - Navigation with Redux auth integration
 */
export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<ActivityIndicator />} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  );
}
