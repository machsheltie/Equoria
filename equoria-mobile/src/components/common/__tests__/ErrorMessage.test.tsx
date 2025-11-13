import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorMessage } from '../ErrorMessage';

// ============================================================================
// TESTS
// ============================================================================

describe('ErrorMessage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // BASIC RENDERING TESTS
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('should render with message', () => {
      const { getByText } = render(
        <ErrorMessage message="Something went wrong" />
      );

      expect(getByText('Something went wrong')).toBeOnTheScreen();
    });

    it('should render with default testID', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" />
      );

      expect(getByTestId('error-message')).toBeOnTheScreen();
    });

    it('should render with custom testID', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" testID="custom-error" />
      );

      expect(getByTestId('custom-error')).toBeOnTheScreen();
    });

    it('should render error icon', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" />
      );

      const icon = getByTestId('error-message-icon');
      expect(icon).toBeOnTheScreen();
      expect(icon).toHaveTextContent('⚠️');
    });

    it('should render all required elements', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Test error message" />
      );

      expect(getByTestId('error-message')).toBeOnTheScreen();
      expect(getByTestId('error-message-icon')).toBeOnTheScreen();
      expect(getByTestId('error-message-title')).toBeOnTheScreen();
      expect(getByTestId('error-message-text')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // TITLE TESTS
  // ==========================================================================

  describe('Title Display', () => {
    it('should display default title "Error"', () => {
      const { getByText, getByTestId } = render(
        <ErrorMessage message="Something went wrong" />
      );

      expect(getByText('Error')).toBeOnTheScreen();
      expect(getByTestId('error-message-title')).toHaveTextContent('Error');
    });

    it('should display custom title', () => {
      const { getByText, getByTestId } = render(
        <ErrorMessage message="Something went wrong" title="Network Error" />
      );

      expect(getByText('Network Error')).toBeOnTheScreen();
      expect(getByTestId('error-message-title')).toHaveTextContent('Network Error');
    });

    it('should render custom title with message', () => {
      const { getByText } = render(
        <ErrorMessage message="Connection failed" title="Connection Problem" />
      );

      expect(getByText('Connection Problem')).toBeOnTheScreen();
      expect(getByText('Connection failed')).toBeOnTheScreen();
    });

    it('should propagate testID to title', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error" testID="test-error" />
      );

      expect(getByTestId('test-error-title')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // MESSAGE TESTS
  // ==========================================================================

  describe('Message Display', () => {
    it('should display error message', () => {
      const message = 'Unable to load data. Please try again.';
      const { getByText } = render(<ErrorMessage message={message} />);

      expect(getByText(message)).toBeOnTheScreen();
    });

    it('should display long error message', () => {
      const longMessage = 'This is a very long error message that explains in detail what went wrong and provides helpful information to the user about how to proceed.';
      const { getByText } = render(<ErrorMessage message={longMessage} />);

      expect(getByText(longMessage)).toBeOnTheScreen();
    });

    it('should propagate testID to message text', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Test error" testID="test-error" />
      );

      expect(getByTestId('test-error-text')).toBeOnTheScreen();
      expect(getByTestId('test-error-text')).toHaveTextContent('Test error');
    });
  });

  // ==========================================================================
  // RETRY CALLBACK TESTS
  // ==========================================================================

  describe('Retry Functionality', () => {
    it('should not render retry button when onRetry is not provided', () => {
      const { queryByTestId } = render(
        <ErrorMessage message="Error occurred" />
      );

      expect(queryByTestId('error-message-retry-button')).not.toBeOnTheScreen();
    });

    it('should render retry button when onRetry is provided', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" onRetry={onRetry} />
      );

      expect(getByTestId('error-message-retry-button')).toBeOnTheScreen();
    });

    it('should call onRetry when retry button is pressed', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" onRetry={onRetry} />
      );

      const retryButton = getByTestId('error-message-retry-button');
      fireEvent.press(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry multiple times when pressed multiple times', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" onRetry={onRetry} />
      );

      const retryButton = getByTestId('error-message-retry-button');
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(3);
    });

    it('should display default retry text "Try Again"', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <ErrorMessage message="Error occurred" onRetry={onRetry} />
      );

      expect(getByText('Try Again')).toBeOnTheScreen();
    });

    it('should display custom retry text', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <ErrorMessage
          message="Error occurred"
          onRetry={onRetry}
          retryText="Retry Now"
        />
      );

      expect(getByText('Retry Now')).toBeOnTheScreen();
    });

    it('should use custom retry text when provided', () => {
      const onRetry = jest.fn();
      const { getByText, queryByText } = render(
        <ErrorMessage
          message="Network error"
          onRetry={onRetry}
          retryText="Reconnect"
        />
      );

      expect(getByText('Reconnect')).toBeOnTheScreen();
      expect(queryByText('Try Again')).not.toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // FULLSCREEN MODE TESTS
  // ==========================================================================

  describe('Fullscreen Mode', () => {
    it('should not be fullscreen by default', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" />
      );

      const container = getByTestId('error-message');
      const styles = container.props.style;

      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ padding: 20 }),
        ])
      );
    });

    it('should render fullscreen when fullscreen=true', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" fullscreen={true} />
      );

      const container = getByTestId('error-message');
      const styles = container.props.style;

      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            flex: 1,
            backgroundColor: '#FFFFFF',
          }),
        ])
      );
    });

    it('should render inline when fullscreen=false', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" fullscreen={false} />
      );

      const container = getByTestId('error-message');
      const styles = container.props.style;

      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ padding: 20 }),
        ])
      );
    });
  });

  // ==========================================================================
  // CUSTOM STYLES TESTS
  // ==========================================================================

  describe('Custom Styles', () => {
    it('should apply custom styles', () => {
      const customStyle = { backgroundColor: '#F0F0F0', margin: 10 };
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" style={customStyle} />
      );

      const container = getByTestId('error-message');
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining(customStyle),
        ])
      );
    });

    it('should merge custom styles with default styles', () => {
      const customStyle = { borderWidth: 1 };
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" style={customStyle} />
      );

      const container = getByTestId('error-message');
      const styles = container.props.style;

      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ padding: 20 }),
          expect.objectContaining(customStyle),
        ])
      );
    });

    it('should override default styles with custom styles in fullscreen mode', () => {
      const customStyle = { backgroundColor: '#000000' };
      const { getByTestId } = render(
        <ErrorMessage
          message="Error occurred"
          fullscreen={true}
          style={customStyle}
        />
      );

      const container = getByTestId('error-message');
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining(customStyle),
        ])
      );
    });
  });

  // ==========================================================================
  // TESTID PROPAGATION TESTS
  // ==========================================================================

  describe('TestID Propagation', () => {
    it('should propagate testID to all elements', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(
        <ErrorMessage
          message="Error occurred"
          onRetry={onRetry}
          testID="test-error"
        />
      );

      expect(getByTestId('test-error')).toBeOnTheScreen();
      expect(getByTestId('test-error-icon')).toBeOnTheScreen();
      expect(getByTestId('test-error-title')).toBeOnTheScreen();
      expect(getByTestId('test-error-text')).toBeOnTheScreen();
      expect(getByTestId('test-error-retry-button')).toBeOnTheScreen();
    });

    it('should use default testID for all elements', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(
        <ErrorMessage message="Error occurred" onRetry={onRetry} />
      );

      expect(getByTestId('error-message')).toBeOnTheScreen();
      expect(getByTestId('error-message-icon')).toBeOnTheScreen();
      expect(getByTestId('error-message-title')).toBeOnTheScreen();
      expect(getByTestId('error-message-text')).toBeOnTheScreen();
      expect(getByTestId('error-message-retry-button')).toBeOnTheScreen();
    });

    it('should propagate custom testID correctly', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error" testID="custom-error-msg" />
      );

      expect(getByTestId('custom-error-msg-icon')).toBeOnTheScreen();
      expect(getByTestId('custom-error-msg-title')).toBeOnTheScreen();
      expect(getByTestId('custom-error-msg-text')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // COMBINATION TESTS
  // ==========================================================================

  describe('Prop Combinations', () => {
    it('should work with all props combined', () => {
      const onRetry = jest.fn();
      const customStyle = { padding: 30 };
      const { getByTestId, getByText } = render(
        <ErrorMessage
          message="Network connection failed"
          title="Connection Error"
          onRetry={onRetry}
          retryText="Reconnect"
          fullscreen={true}
          style={customStyle}
          testID="full-error"
        />
      );

      const container = getByTestId('full-error');

      expect(container).toBeOnTheScreen();
      expect(getByText('Connection Error')).toBeOnTheScreen();
      expect(getByText('Network connection failed')).toBeOnTheScreen();
      expect(getByText('Reconnect')).toBeOnTheScreen();
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ flex: 1 }),
          expect.objectContaining(customStyle),
        ])
      );

      fireEvent.press(getByTestId('full-error-retry-button'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should work with minimal props', () => {
      const { getByText } = render(
        <ErrorMessage message="Error occurred" />
      );

      expect(getByText('Error')).toBeOnTheScreen();
      expect(getByText('Error occurred')).toBeOnTheScreen();
    });

    it('should work with custom title and retry', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <ErrorMessage
          message="Failed to load"
          title="Loading Error"
          onRetry={onRetry}
        />
      );

      expect(getByText('Loading Error')).toBeOnTheScreen();
      expect(getByText('Failed to load')).toBeOnTheScreen();
      expect(getByText('Try Again')).toBeOnTheScreen();
    });

    it('should work with fullscreen and retry', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(
        <ErrorMessage
          message="Error"
          fullscreen={true}
          onRetry={onRetry}
        />
      );

      const container = getByTestId('error-message');
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ flex: 1 }),
        ])
      );
      expect(getByTestId('error-message-retry-button')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty message string', () => {
      const { getByTestId } = render(<ErrorMessage message="" />);

      expect(getByTestId('error-message-text')).toHaveTextContent('');
    });

    it('should handle special characters in message', () => {
      const message = 'Error: <>&"\'';
      const { getByText } = render(<ErrorMessage message={message} />);

      expect(getByText(message)).toBeOnTheScreen();
    });

    it('should handle null custom style', () => {
      const { getByTestId } = render(
        <ErrorMessage message="Error" style={null as any} />
      );

      expect(getByTestId('error-message')).toBeOnTheScreen();
    });

    it('should handle undefined onRetry gracefully', () => {
      const { queryByTestId } = render(
        <ErrorMessage message="Error" onRetry={undefined} />
      );

      expect(queryByTestId('error-message-retry-button')).not.toBeOnTheScreen();
    });

    it('should handle custom retryText without onRetry', () => {
      const { queryByText } = render(
        <ErrorMessage message="Error" retryText="Custom Retry" />
      );

      // Retry text should not appear if there's no onRetry callback
      expect(queryByText('Custom Retry')).not.toBeOnTheScreen();
    });
  });
});
