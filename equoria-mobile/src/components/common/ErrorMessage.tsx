import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';

export interface ErrorMessageProps {
  /** Error message to display */
  message: string;
  /** Optional error title. Default: 'Error' */
  title?: string;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Retry button text. Default: 'Try Again' */
  retryText?: string;
  /** Whether to display as fullscreen. Default: false */
  fullscreen?: boolean;
  /** Additional styles for the container */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * ErrorMessage component that displays an error with optional retry action.
 * Can be used as inline or fullscreen error display.
 */
export function ErrorMessage({
  message,
  title = 'Error',
  onRetry,
  retryText = 'Try Again',
  fullscreen = false,
  style,
  testID = 'error-message',
}: ErrorMessageProps) {
  const containerStyle = [
    fullscreen ? styles.fullscreenContainer : styles.container,
    style,
  ];

  return (
    <View style={containerStyle} testID={testID}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon} testID={`${testID}-icon`}>
          ⚠️
        </Text>
      </View>

      <Text style={styles.title} testID={`${testID}-title`}>
        {title}
      </Text>

      <Text style={styles.message} testID={`${testID}-text`}>
        {message}
      </Text>

      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          testID={`${testID}-retry-button`}
        >
          <Text style={styles.retryText}>{retryText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#DC3545',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
