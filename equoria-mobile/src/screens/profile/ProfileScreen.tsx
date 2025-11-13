import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ProfileStackScreenProps } from '@navigation/types';

type Props = ProfileStackScreenProps<'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  return (
    <View style={styles.container} testID="profile-screen">
      <Text style={styles.title}>Profile Screen</Text>
      <Text style={styles.subtitle}>Placeholder for Profile UI</Text>
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
