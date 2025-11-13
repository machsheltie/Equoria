import React from 'react';
import { render } from '@testing-library/react-native';
import { Loading } from '../Loading';

// ============================================================================
// TESTS
// ============================================================================

describe('Loading Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // BASIC RENDERING TESTS
  // ==========================================================================

  describe('Basic Rendering', () => {
    it('should render with default props', () => {
      const { getByTestId } = render(<Loading />);

      expect(getByTestId('loading')).toBeOnTheScreen();
      expect(getByTestId('loading-indicator')).toBeOnTheScreen();
    });

    it('should render with default testID', () => {
      const { getByTestId } = render(<Loading />);

      expect(getByTestId('loading')).toBeOnTheScreen();
    });

    it('should render with custom testID', () => {
      const { getByTestId } = render(<Loading testID="custom-loading" />);

      expect(getByTestId('custom-loading')).toBeOnTheScreen();
      expect(getByTestId('custom-loading-indicator')).toBeOnTheScreen();
    });

    it('should render ActivityIndicator', () => {
      const { getByTestId } = render(<Loading />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator).toBeOnTheScreen();
      expect(indicator.type).toBe('ActivityIndicator');
    });
  });

  // ==========================================================================
  // MESSAGE TESTS
  // ==========================================================================

  describe('Message Display', () => {
    it('should not render message by default', () => {
      const { queryByTestId } = render(<Loading />);

      expect(queryByTestId('loading-message')).not.toBeOnTheScreen();
    });

    it('should render message when provided', () => {
      const { getByTestId, getByText } = render(
        <Loading message="Loading data..." />
      );

      expect(getByTestId('loading-message')).toBeOnTheScreen();
      expect(getByText('Loading data...')).toBeOnTheScreen();
    });

    it('should render custom message text', () => {
      const { getByText } = render(
        <Loading message="Please wait while we load your content" />
      );

      expect(getByText('Please wait while we load your content')).toBeOnTheScreen();
    });

    it('should not render message when message is empty string', () => {
      const { queryByTestId } = render(<Loading message="" />);

      expect(queryByTestId('loading-message')).not.toBeOnTheScreen();
    });

    it('should propagate testID to message', () => {
      const { getByTestId } = render(
        <Loading message="Loading..." testID="custom-loader" />
      );

      expect(getByTestId('custom-loader-message')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // SIZE TESTS
  // ==========================================================================

  describe('Indicator Size', () => {
    it('should use large size by default', () => {
      const { getByTestId } = render(<Loading />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.size).toBe('large');
    });

    it('should render with small size', () => {
      const { getByTestId } = render(<Loading size="small" />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.size).toBe('small');
    });

    it('should render with large size explicitly', () => {
      const { getByTestId } = render(<Loading size="large" />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.size).toBe('large');
    });
  });

  // ==========================================================================
  // COLOR TESTS
  // ==========================================================================

  describe('Indicator Color', () => {
    it('should use default color (#007AFF)', () => {
      const { getByTestId } = render(<Loading />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.color).toBe('#007AFF');
    });

    it('should apply custom color', () => {
      const { getByTestId } = render(<Loading color="#FF0000" />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.color).toBe('#FF0000');
    });

    it('should apply custom hex color', () => {
      const { getByTestId } = render(<Loading color="#00FF00" />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.color).toBe('#00FF00');
    });

    it('should apply named color', () => {
      const { getByTestId } = render(<Loading color="red" />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.color).toBe('red');
    });
  });

  // ==========================================================================
  // FULLSCREEN MODE TESTS
  // ==========================================================================

  describe('Fullscreen Mode', () => {
    it('should not be fullscreen by default', () => {
      const { getByTestId } = render(<Loading />);

      const container = getByTestId('loading');
      const styles = container.props.style;

      // Default inline container should not have flex: 1
      expect(styles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ padding: 20 }),
        ])
      );
    });

    it('should render fullscreen when fullscreen=true', () => {
      const { getByTestId } = render(<Loading fullscreen={true} />);

      const container = getByTestId('loading');
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
      const { getByTestId } = render(<Loading fullscreen={false} />);

      const container = getByTestId('loading');
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
      const { getByTestId } = render(<Loading style={customStyle} />);

      const container = getByTestId('loading');
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining(customStyle),
        ])
      );
    });

    it('should merge custom styles with default styles', () => {
      const customStyle = { borderWidth: 1 };
      const { getByTestId } = render(<Loading style={customStyle} />);

      const container = getByTestId('loading');
      const styles = container.props.style;

      // Should contain both default and custom styles
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
        <Loading fullscreen={true} style={customStyle} />
      );

      const container = getByTestId('loading');
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
    it('should propagate testID to indicator', () => {
      const { getByTestId } = render(<Loading testID="test-loading" />);

      expect(getByTestId('test-loading-indicator')).toBeOnTheScreen();
    });

    it('should propagate testID to message when present', () => {
      const { getByTestId } = render(
        <Loading message="Loading..." testID="test-loading" />
      );

      expect(getByTestId('test-loading-message')).toBeOnTheScreen();
    });

    it('should use default testID for all elements', () => {
      const { getByTestId } = render(<Loading message="Loading..." />);

      expect(getByTestId('loading')).toBeOnTheScreen();
      expect(getByTestId('loading-indicator')).toBeOnTheScreen();
      expect(getByTestId('loading-message')).toBeOnTheScreen();
    });
  });

  // ==========================================================================
  // COMBINATION TESTS
  // ==========================================================================

  describe('Prop Combinations', () => {
    it('should work with all props combined', () => {
      const customStyle = { padding: 30 };
      const { getByTestId, getByText } = render(
        <Loading
          message="Loading your data..."
          size="small"
          color="#FF0000"
          fullscreen={true}
          style={customStyle}
          testID="full-loading"
        />
      );

      const container = getByTestId('full-loading');
      const indicator = getByTestId('full-loading-indicator');

      expect(container).toBeOnTheScreen();
      expect(indicator.props.size).toBe('small');
      expect(indicator.props.color).toBe('#FF0000');
      expect(getByText('Loading your data...')).toBeOnTheScreen();
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ flex: 1 }),
          expect.objectContaining(customStyle),
        ])
      );
    });

    it('should work with minimal props', () => {
      const { getByTestId } = render(<Loading />);

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.size).toBe('large');
      expect(indicator.props.color).toBe('#007AFF');
    });

    it('should work with message and custom color', () => {
      const { getByTestId, getByText } = render(
        <Loading message="Please wait..." color="#00FF00" />
      );

      const indicator = getByTestId('loading-indicator');
      expect(indicator.props.color).toBe('#00FF00');
      expect(getByText('Please wait...')).toBeOnTheScreen();
    });

    it('should work with small size and fullscreen', () => {
      const { getByTestId } = render(
        <Loading size="small" fullscreen={true} />
      );

      const container = getByTestId('loading');
      const indicator = getByTestId('loading-indicator');

      expect(indicator.props.size).toBe('small');
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ flex: 1 }),
        ])
      );
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle undefined message gracefully', () => {
      const { queryByTestId } = render(<Loading message={undefined} />);

      expect(queryByTestId('loading-message')).not.toBeOnTheScreen();
    });

    it('should handle null custom style', () => {
      const { getByTestId } = render(<Loading style={null as any} />);

      expect(getByTestId('loading')).toBeOnTheScreen();
    });

    it('should handle multiple style objects', () => {
      const style1 = { margin: 10 };
      const style2 = { padding: 20 };
      const { getByTestId } = render(<Loading style={[style1, style2] as any} />);

      expect(getByTestId('loading')).toBeOnTheScreen();
    });
  });
});
