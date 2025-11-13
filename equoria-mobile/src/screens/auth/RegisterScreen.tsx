import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AuthStackScreenProps } from '@navigation/types';

type Props = AuthStackScreenProps<'Register'>;

export function RegisterScreen({ navigation: _navigation }: Props) {
  return (
    <View style={styles.container} testID="register-screen">
      <Text style={styles.title}>Register Screen</Text>
      <Text style={styles.subtitle}>Placeholder for Registration UI</Text>
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
