import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ActivityIndicator } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { store, persistor } from './src/state/store';
import { queryClient } from './src/state/queryClient';
import { testApiConnection } from './src/api/test';

function AppContent() {
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkApiConnection = useCallback(async () => {
    setIsChecking(true);
    const connected = await testApiConnection();
    setApiConnected(connected);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    checkApiConnection();
  }, [checkApiConnection]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Equoria Mobile</Text>
      <Text style={styles.subtitle}>Horse Breeding Simulation</Text>
      <Text style={styles.version}>Version 0.2.0 - Week 1 Day 2</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Backend API Status:</Text>
        {isChecking ? (
          <ActivityIndicator size="small" color="#1E40AF" />
        ) : (
          <Text
            style={[
              styles.statusValue,
              { color: apiConnected ? '#10B981' : '#EF4444' },
            ]}
          >
            {apiConnected === null
              ? 'Not Tested'
              : apiConnected
              ? 'Connected ✓'
              : 'Offline ✗'}
          </Text>
        )}
      </View>

      {!apiConnected && apiConnected !== null && (
        <Text style={styles.offlineNote}>
          Note: Backend is offline. Frontend can still be developed.
        </Text>
      )}

      <Button
        title={isChecking ? 'Testing...' : 'Test Connection'}
        onPress={checkApiConnection}
        disabled={isChecking}
      />

      <View style={styles.completedContainer}>
        <Text style={styles.completedTitle}>✅ Day 2 Progress:</Text>
        <Text style={styles.completedItem}>• Redux Toolkit integrated</Text>
        <Text style={styles.completedItem}>• React Query configured</Text>
        <Text style={styles.completedItem}>• Redux Persist enabled</Text>
        <Text style={styles.completedItem}>• Auth state management</Text>
        <Text style={styles.completedItem}>• Query hooks (login/logout)</Text>
        <Text style={styles.completedItem}>• TDD with 100% coverage</Text>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

// Provider wrapper component
export default function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<ActivityIndicator />} persistor={persistor}>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1E40AF',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  version: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 32,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  offlineNote: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  completedContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    width: '100%',
  },
  completedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#10B981',
  },
  completedItem: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
});
