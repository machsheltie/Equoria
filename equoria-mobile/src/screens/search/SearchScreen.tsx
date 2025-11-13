import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { SearchStackScreenProps } from '@navigation/types';

type Props = SearchStackScreenProps<'Search'>;

export function SearchScreen({ navigation, route }: Props) {
  return (
    <View style={styles.container} testID="search-screen">
      <Text style={styles.title}>Search Screen</Text>
      <Text style={styles.subtitle}>Placeholder for Search UI</Text>
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
