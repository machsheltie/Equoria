import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { HomeStackScreenProps } from '@navigation/types';

type Props = HomeStackScreenProps<'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container} testID="home-screen">
      <Text style={styles.title}>Home Screen</Text>
      <Text style={styles.subtitle}>Placeholder for Home UI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
