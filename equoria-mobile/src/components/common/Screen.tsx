import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface ScreenProps {
  children: React.ReactNode;
  /** Whether to wrap content in ScrollView. Default: false */
  scrollable?: boolean;
  /** Whether to use SafeAreaView. Default: true */
  safe?: boolean;
  /** Whether to use KeyboardAvoidingView. Default: true */
  keyboardAvoiding?: boolean;
  /** Custom background color */
  backgroundColor?: string;
  /** Additional styles for the container */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Base Screen wrapper component that provides:
 * - Safe area handling
 * - Keyboard avoidance
 * - Optional scrolling
 * - Consistent background and styling
 */
export function Screen({
  children,
  scrollable = false,
  safe = true,
  keyboardAvoiding = true,
  backgroundColor = '#FFFFFF',
  style,
  testID = 'screen',
}: ScreenProps) {
  const containerStyle = [
    styles.container,
    { backgroundColor },
    style,
  ];

  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      testID={`${testID}-scroll`}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content} testID={`${testID}-content`}>
      {children}
    </View>
  );

  const wrappedContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
      testID={`${testID}-keyboard-avoiding`}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  if (safe) {
    return (
      <SafeAreaView style={containerStyle} testID={testID}>
        {wrappedContent}
      </SafeAreaView>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      {wrappedContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
});
