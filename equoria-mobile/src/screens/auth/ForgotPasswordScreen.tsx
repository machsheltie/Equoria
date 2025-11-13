import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AuthStackScreenProps } from '@navigation/types';

type Props = AuthStackScreenProps<'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  return (
    <View style={styles.container} testID="forgot-password-screen">
      <Text style={styles.title}>Forgot Password Screen</Text>
      <Text style={styles.subtitle}>Placeholder for Password Reset UI</Text>
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
