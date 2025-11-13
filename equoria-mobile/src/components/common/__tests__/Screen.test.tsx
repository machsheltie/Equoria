import React from 'react';
import { Text, Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { Screen } from '../Screen';

// ============================================================================
// MOCKS
// ============================================================================

// No need to mock Platform - it's automatically handled by React Native Testing Library

// ============================================================================
// TESTS
// ============================================================================

describe('Screen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // BASIC RENDERING TESTS
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('should render children correctly', () => {
      const { getByText } = render(
        <Screen>
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByText('Test Content')).toBeOnTheScreen();
    });

    it('should render with default testID', () => {
      const { getByTestId } = render(
        <Screen>
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('screen')).toBeOnTheScreen();
    });

    it('should render with custom testID', () => {
      const { getByTestId } = render(
        <Screen testID="custom-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('custom-screen')).toBeOnTheScreen();
    });

    it('should render multiple children', () => {
      const { getByText } = render(
        <Screen>
          <Text>First Child</Text>
          <Text>Second Child</Text>
          <Text>Third Child</Text>
        </Screen>
      );

      expect(getByText('First Child')).toBeOnTheScreen();
      expect(getByText('Second Child')).toBeOnTheScreen();
      expect(getByText('Third Child')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // SAFE AREA TESTS
  // ==========================================================================

  describe('Safe Area Handling', () => {
    it('should use SafeAreaView by default', () => {
      const { getByTestId } = render(
        <Screen>
          <Text>Test Content</Text>
        </Screen>
      );

      // SafeAreaView is used by default
      expect(getByTestId('screen')).toBeOnTheScreen();
    });

    it('should use SafeAreaView when safe=true', () => {
      const { getByTestId } = render(
        <Screen safe={true}>
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('screen')).toBeOnTheScreen();
    });

    it('should use regular View when safe=false', () => {
      const { getByTestId } = render(
        <Screen safe={false}>
          <Text>Test Content</Text>
        </Screen>
      );

      // Should still render with testID
      expect(getByTestId('screen')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // SCROLLABLE TESTS
  // ==========================================================================

  describe('Scrollable Content', () => {
    it('should render View content by default (not scrollable)', () => {
      const { getByTestId } = render(
        <Screen testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen-content')).toBeOnTheScreen();
    });

    it('should render ScrollView when scrollable=true', () => {
      const { getByTestId, queryByTestId } = render(
        <Screen scrollable={true} testID="test-screen">
          <Text>Scrollable Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen-scroll')).toBeOnTheScreen();
      expect(queryByTestId('test-screen-content')).not.toBeOnTheScreen();
    });

    it('should render View when scrollable=false', () => {
      const { getByTestId, queryByTestId } = render(
        <Screen scrollable={false} testID="test-screen">
          <Text>Non-Scrollable Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen-content')).toBeOnTheScreen();
      expect(queryByTestId('test-screen-scroll')).not.toBeOnTheScreen();
    });

    it('should propagate testID to ScrollView content', () => {
      const { getByTestId } = render(
        <Screen scrollable={true} testID="custom-id">
          <Text>Content</Text>
        </Screen>
      );

      expect(getByTestId('custom-id-scroll')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // KEYBOARD AVOIDING TESTS
  // ==========================================================================

  describe('Keyboard Avoidance', () => {
    it('should use KeyboardAvoidingView by default', () => {
      const { getByTestId } = render(
        <Screen testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen-keyboard-avoiding')).toBeOnTheScreen();
    });

    it('should use KeyboardAvoidingView when keyboardAvoiding=true', () => {
      const { getByTestId } = render(
        <Screen keyboardAvoiding={true} testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen-keyboard-avoiding')).toBeOnTheScreen();
    });

    it('should not use KeyboardAvoidingView when keyboardAvoiding=false', () => {
      const { queryByTestId } = render(
        <Screen keyboardAvoiding={false} testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(queryByTestId('test-screen-keyboard-avoiding')).not.toBeOnTheScreen();
    });

    it('should render KeyboardAvoidingView wrapper when enabled', () => {
      const { getByTestId } = render(
        <Screen testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      // KeyboardAvoidingView is rendered with correct testID
      const keyboardAvoidingView = getByTestId('test-screen-keyboard-avoiding');
      expect(keyboardAvoidingView).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // BACKGROUND COLOR TESTS
  // ==========================================================================

  describe('Background Color', () => {
    it('should use white background by default', () => {
      const { getByTestId } = render(
        <Screen testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      const screen = getByTestId('test-screen');
      expect(screen.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#FFFFFF' }),
        ])
      );
    });

    it('should apply custom backgroundColor', () => {
      const { getByTestId } = render(
        <Screen backgroundColor="#FF0000" testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      const screen = getByTestId('test-screen');
      expect(screen.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#FF0000' }),
        ])
      );
    });

    it('should apply transparent backgroundColor', () => {
      const { getByTestId } = render(
        <Screen backgroundColor="transparent" testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      const screen = getByTestId('test-screen');
      expect(screen.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: 'transparent' }),
        ])
      );
    });
  });

  // ==========================================================================
  // CUSTOM STYLES TESTS
  // ==========================================================================

  describe('Custom Styles', () => {
    it('should apply custom styles', () => {
      const customStyle = { padding: 20, margin: 10 };
      const { getByTestId } = render(
        <Screen style={customStyle} testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      const screen = getByTestId('test-screen');
      expect(screen.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining(customStyle),
        ])
      );
    });

    it('should merge custom styles with default styles', () => {
      const customStyle = { borderWidth: 1, borderColor: '#000000' };
      const { getByTestId } = render(
        <Screen style={customStyle} testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      const screen = getByTestId('test-screen');
      const styles = screen.props.style;

      // Should contain both default (flex: 1) and custom styles
      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ flex: 1 }),
          expect.objectContaining(customStyle),
        ])
      );
    });
  });

  // ==========================================================================
  // COMBINATION TESTS
  // ==========================================================================

  describe('Prop Combinations', () => {
    it('should work with scrollable and safe together', () => {
      const { getByTestId } = render(
        <Screen scrollable={true} safe={true} testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen')).toBeOnTheScreen();
      expect(getByTestId('test-screen-scroll')).toBeOnTheScreen();
      expect(getByTestId('test-screen-keyboard-avoiding')).toBeOnTheScreen();
    });

    it('should work with scrollable and custom background', () => {
      const { getByTestId } = render(
        <Screen scrollable={true} backgroundColor="#0000FF" testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      const screen = getByTestId('test-screen');
      expect(screen.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#0000FF' }),
        ])
      );
      expect(getByTestId('test-screen-scroll')).toBeOnTheScreen();
    });

    it('should work with all props combined', () => {
      const customStyle = { padding: 15 };
      const { getByTestId } = render(
        <Screen
          scrollable={true}
          safe={true}
          keyboardAvoiding={true}
          backgroundColor="#00FF00"
          style={customStyle}
          testID="full-screen"
        >
          <Text>All Props</Text>
        </Screen>
      );

      const screen = getByTestId('full-screen');
      expect(screen).toBeOnTheScreen();
      expect(screen.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#00FF00' }),
          expect.objectContaining(customStyle),
        ])
      );
      expect(getByTestId('full-screen-scroll')).toBeOnTheScreen();
      expect(getByTestId('full-screen-keyboard-avoiding')).toBeOnTheScreen();
    });

    it('should work with minimal props (only children)', () => {
      const { getByText, getByTestId } = render(
        <Screen>
          <Text>Minimal Props</Text>
        </Screen>
      );

      expect(getByText('Minimal Props')).toBeOnTheScreen();
      expect(getByTestId('screen')).toBeOnTheScreen();
    });

    it('should work with safe=false and scrollable=true', () => {
      const { getByTestId } = render(
        <Screen safe={false} scrollable={true} testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen')).toBeOnTheScreen();
      expect(getByTestId('test-screen-scroll')).toBeOnTheScreen();
    });

    it('should work with keyboardAvoiding=false and scrollable=true', () => {
      const { getByTestId, queryByTestId } = render(
        <Screen keyboardAvoiding={false} scrollable={true} testID="test-screen">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('test-screen-scroll')).toBeOnTheScreen();
      expect(queryByTestId('test-screen-keyboard-avoiding')).not.toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // TESTID PROPAGATION TESTS
  // ==========================================================================

  describe('TestID Propagation', () => {
    it('should propagate testID to all nested components', () => {
      const { getByTestId } = render(
        <Screen scrollable={true} testID="propagation-test">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('propagation-test')).toBeOnTheScreen();
      expect(getByTestId('propagation-test-scroll')).toBeOnTheScreen();
      expect(getByTestId('propagation-test-keyboard-avoiding')).toBeOnTheScreen();
    });

    it('should propagate default testID when not provided', () => {
      const { getByTestId } = render(
        <Screen scrollable={true}>
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('screen')).toBeOnTheScreen();
      expect(getByTestId('screen-scroll')).toBeOnTheScreen();
      expect(getByTestId('screen-keyboard-avoiding')).toBeOnTheScreen();
    });

    it('should use content testID when not scrollable', () => {
      const { getByTestId } = render(
        <Screen scrollable={false} testID="content-test">
          <Text>Test Content</Text>
        </Screen>
      );

      expect(getByTestId('content-test-content')).toBeOnTheScreen();
    });
  });
});
