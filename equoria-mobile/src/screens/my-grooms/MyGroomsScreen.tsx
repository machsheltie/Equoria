import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MyGroomsStackScreenProps } from '@navigation/types';

type Props = MyGroomsStackScreenProps<'MyGrooms'>;

export function MyGroomsScreen({ navigation, route }: Props) {
  return (
    <View style={styles.container} testID="my-grooms-screen">
      <Text style={styles.title}>My Grooms Screen</Text>
      <Text style={styles.subtitle}>Placeholder for My Grooms UI</Text>
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
