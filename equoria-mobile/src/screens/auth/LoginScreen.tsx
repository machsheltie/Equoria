import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AuthStackScreenProps } from '@navigation/types';

type Props = AuthStackScreenProps<'Login'>;

export function LoginScreen({ navigation: _navigation }: Props) {
  return (
    <View style={styles.container} testID="login-screen">
      <Text style={styles.title}>Login Screen</Text>
      <Text style={styles.subtitle}>Placeholder for Login UI</Text>
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
