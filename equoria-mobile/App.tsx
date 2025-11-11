import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ActivityIndicator } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { testApiConnection } from './src/api/test';

export default function App() {
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
      <Text style={styles.version}>Version 0.1.0 - Week 1 Day 1</Text>

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
        <Text style={styles.completedTitle}>✅ Day 1 Completed:</Text>
        <Text style={styles.completedItem}>• Expo project initialized</Text>
        <Text style={styles.completedItem}>• Folder structure created</Text>
        <Text style={styles.completedItem}>• Dependencies installed</Text>
        <Text style={styles.completedItem}>• TypeScript configured</Text>
        <Text style={styles.completedItem}>• API client setup</Text>
        <Text style={styles.completedItem}>• Environment config ready</Text>
      </View>

      <StatusBar style="auto" />
    </View>
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
