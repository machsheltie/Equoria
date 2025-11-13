import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';

export interface LoadingProps {
  /** Loading message to display */
  message?: string;
  /** Size of the loading indicator. Default: 'large' */
  size?: 'small' | 'large';
  /** Color of the loading indicator. Default: '#007AFF' */
  color?: string;
  /** Whether to display as fullscreen overlay. Default: false */
  fullscreen?: boolean;
  /** Additional styles for the container */
  style?: ViewStyle;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Loading component that displays an activity indicator with optional message.
 * Can be used as inline or fullscreen overlay.
 */
export function Loading({
  message,
  size = 'large',
  color = '#007AFF',
  fullscreen = false,
  style,
  testID = 'loading',
}: LoadingProps) {
  const containerStyle = [
    fullscreen ? styles.fullscreenContainer : styles.container,
    style,
  ];

  return (
    <View style={containerStyle} testID={testID}>
      <ActivityIndicator
        size={size}
        color={color}
        testID={`${testID}-indicator`}
      />
      {message && (
        <Text style={styles.message} testID={`${testID}-message`}>
          {message}
        </Text>
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
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#333333',
    textAlign: 'center',
  },
});
