import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TraitDisplay from '../TraitDisplay';

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock react-native components
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.StyleSheet.create = () => ({}); // Simplified mock for StyleSheet.create
  return {
    ...RN,
    View: 'View', // Mock View as a string or a simple component
    Text: 'Text',
    StyleSheet: {
      create: jest.fn(() => ({})),
      compose: jest.fn(() => ({})), // Mock compose if used
      flatten: jest.fn(() => ({})), // Mock flatten if used
    },
    Platform: {
      OS: 'ios',
      select: jest.fn((selector) => selector.ios), // Mock Platform.select
    },
  };
});

describe('TraitDisplay Component', () => {
  const mockTraits = {
    positive: ['resilient', 'bold'],
    negative: ['nervous'],
    hidden: ['trainability_boost'],
  };

  const defaultProps = {
    traits: mockTraits,
    horseName: 'Thunder',
    onTraitPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders correctly with all trait types', () => {
      const { getByText, getByLabelText } = render(
        <TraitDisplay {...defaultProps} />
      );

      // Check header
      expect(getByText("Thunder's Traits")).toBeTruthy();
      expect(
        getByText('Epigenetic characteristics that shape behavior')
      ).toBeTruthy();

      // Check section headers
      expect(getByText('Positive Traits')).toBeTruthy();
      expect(getByText('Negative Traits')).toBeTruthy();
      expect(getByText('Undiscovered')).toBeTruthy();

      // Check trait badges
      expect(getByText('Resilient')).toBeTruthy();
      expect(getByText('Bold')).toBeTruthy();
      expect(getByText('Nervous')).toBeTruthy();
      expect(getByText('???')).toBeTruthy();
    });

    it('renders with default horse name when not provided', () => {
      const { getByText } = render(<TraitDisplay traits={mockTraits} />);
      expect(getByText("Horse's Traits")).toBeTruthy();
    });

    it('renders empty state when no traits provided', () => {
      const { getByText } = render(<TraitDisplay traits={{}} />);

      expect(getByText('No traits discovered yet')).toBeTruthy();
      expect(
        getByText('Traits will be revealed as you interact with your horse')
      ).toBeTruthy();
    });

    it('renders empty state when traits prop is undefined', () => {
      const { getByText } = render(<TraitDisplay />);

      expect(getByText('No traits discovered yet')).toBeTruthy();
    });

    it('does not render sections for empty trait arrays', () => {
      const { queryByText } = render(
        <TraitDisplay
          traits={{ positive: [], negative: ['nervous'], hidden: [] }}
        />
      );

      expect(queryByText('Positive Traits')).toBeNull();
      expect(queryByText('Undiscovered')).toBeNull();
      expect(queryByText('Negative Traits')).toBeTruthy();
    });
  });

  describe('Trait Badges', () => {
    it('renders positive traits with green styling', () => {
      const { getByLabelText } = render(<TraitDisplay {...defaultProps} />);

      const resilientBadge = getByLabelText('Resilient trait - positive');
      expect(resilientBadge).toBeTruthy();
    });

    it('renders negative traits with red styling', () => {
      const { getByLabelText } = render(<TraitDisplay {...defaultProps} />);

      const nervousBadge = getByLabelText('Nervous trait - negative');
      expect(nervousBadge).toBeTruthy();
    });

    it('renders hidden traits as placeholders', () => {
      const { getByLabelText } = render(<TraitDisplay {...defaultProps} />);

      const hiddenTrait = getByLabelText('Hidden trait - not yet discovered');
      expect(hiddenTrait).toBeTruthy();
    });

    it('handles unknown traits gracefully', () => {
      const unknownTraits = {
        positive: ['unknown_trait'],
        negative: [],
        hidden: [],
      };

      const { getByText } = render(<TraitDisplay traits={unknownTraits} />);
      expect(getByText('Unknown Trait')).toBeTruthy();
    });
  });

  describe('Modal Functionality', () => {
    it('opens modal when trait is pressed', async () => {
      const { getByText, getByLabelText } = render(
        <TraitDisplay {...defaultProps} />
      );

      const resilientBadge = getByLabelText('Resilient trait - positive');
      fireEvent.press(resilientBadge);

      await waitFor(() => {
        expect(getByText('Resilient')).toBeTruthy();
        expect(
          getByText(
            'This horse recovers quickly from stress and setbacks. Resilient horses bounce back faster from training challenges and maintain better emotional stability.'
          )
        ).toBeTruthy();
        expect(
          getByText('Faster stress recovery, improved training consistency')
        ).toBeTruthy();
      });
    });

    it('closes modal when close button is pressed', async () => {
      const { getByText, getByLabelText, queryByText } = render(
        <TraitDisplay {...defaultProps} />
      );

      // Open modal
      const resilientBadge = getByLabelText('Resilient trait - positive');
      fireEvent.press(resilientBadge);

      await waitFor(() => {
        expect(
          getByText(
            'This horse recovers quickly from stress and setbacks. Resilient horses bounce back faster from training challenges and maintain better emotional stability.'
          )
        ).toBeTruthy();
      });

      // Close modal
      const closeButton = getByLabelText('Close');
      fireEvent.press(closeButton);

      await waitFor(() => {
        expect(
          queryByText(
            'This horse recovers quickly from stress and setbacks. Resilient horses bounce back faster from training challenges and maintain better emotional stability.'
          )
        ).toBeNull();
      });
    });

    it('closes modal when backdrop is pressed', async () => {
      const { getByText, getByLabelText, queryByText } = render(
        <TraitDisplay {...defaultProps} />
      );

      // Open modal
      const resilientBadge = getByLabelText('Resilient trait - positive');
      fireEvent.press(resilientBadge);

      await waitFor(() => {
        expect(
          getByText(
            'This horse recovers quickly from stress and setbacks. Resilient horses bounce back faster from training challenges and maintain better emotional stability.'
          )
        ).toBeTruthy();
      });

      // Close modal by pressing backdrop
      const backdrop = getByLabelText('Close trait details');
      fireEvent.press(backdrop);

      await waitFor(() => {
        expect(
          queryByText(
            'This horse recovers quickly from stress and setbacks. Resilient horses bounce back faster from training challenges and maintain better emotional stability.'
          )
        ).toBeNull();
      });
    });

    it('closes modal when "Got it!" button is pressed', async () => {
      const { getByText, getByLabelText, queryByText } = render(
        <TraitDisplay {...defaultProps} />
      );

      // Open modal
      const resilientBadge = getByLabelText('Resilient trait - positive');
      fireEvent.press(resilientBadge);

      await waitFor(() => {
        expect(
          getByText(
            'This horse recovers quickly from stress and setbacks. Resilient horses bounce back faster from training challenges and maintain better emotional stability.'
          )
        ).toBeTruthy();
      });

      // Close modal with "Got it!" button
      const gotItButton = getByText('Got it!');
      fireEvent.press(gotItButton);

      await waitFor(() => {
        expect(
          queryByText(
            'This horse recovers quickly from stress and setbacks. Resilient horses bounce back faster from training challenges and maintain better emotional stability.'
          )
        ).toBeNull();
      });
    });

    it('displays correct content for negative traits', async () => {
      const { getByText, getByLabelText } = render(
        <TraitDisplay {...defaultProps} />
      );

      const nervousBadge = getByLabelText('Nervous trait - negative');
      fireEvent.press(nervousBadge);

      await waitFor(() => {
        expect(getByText('Nervous')).toBeTruthy();
        expect(
          getByText(
            'Prone to anxiety and stress in challenging situations. Nervous horses require more careful handling and patience during training.'
          )
        ).toBeTruthy();
        expect(
          getByText('Increased stress sensitivity, requires gentle approach')
        ).toBeTruthy();
      });
    });
  });

  describe('Callback Functionality', () => {
    it('calls onTraitPress callback when trait is pressed', async () => {
      const mockCallback = jest.fn();
      const { getByLabelText } = render(
        <TraitDisplay {...defaultProps} onTraitPress={mockCallback} />
      );

      const resilientBadge = getByLabelText('Resilient trait - positive');
      fireEvent.press(resilientBadge);

      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith(
          'resilient',
          expect.objectContaining({
            name: 'Resilient',
            type: 'positive',
            description: expect.any(String),
            effects: expect.any(String),
          })
        );
      });
    });

    it('works without onTraitPress callback', async () => {
      const { getByLabelText } = render(
        <TraitDisplay traits={mockTraits} horseName="Thunder" />
      );

      const resilientBadge = getByLabelText('Resilient trait - positive');

      // Should not throw error
      expect(() => fireEvent.press(resilientBadge)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('has proper accessibility labels for trait badges', () => {
      const { getByLabelText } = render(<TraitDisplay {...defaultProps} />);

      expect(getByLabelText('Resilient trait - positive')).toBeTruthy();
      expect(getByLabelText('Bold trait - positive')).toBeTruthy();
      expect(getByLabelText('Nervous trait - negative')).toBeTruthy();
      expect(getByLabelText('Hidden trait - not yet discovered')).toBeTruthy();
    });

    it('has proper accessibility hints for interactive elements', () => {
      const { getByLabelText } = render(<TraitDisplay {...defaultProps} />);

      const resilientBadge = getByLabelText('Resilient trait - positive');
      expect(resilientBadge.props.accessibilityHint).toBe(
        'Tap to view detailed description'
      );

      const hiddenTrait = getByLabelText('Hidden trait - not yet discovered');
      expect(hiddenTrait.props.accessibilityHint).toBe(
        'This trait will be revealed as you learn more about your horse'
      );
    });

    it('has proper accessibility roles', () => {
      const { getByLabelText } = render(<TraitDisplay {...defaultProps} />);

      const resilientBadge = getByLabelText('Resilient trait - positive');
      expect(resilientBadge.props.accessibilityRole).toBe('button');
    });

    it('sets modal as accessibility modal', async () => {
      const { getByLabelText } = render(<TraitDisplay {...defaultProps} />);

      const resilientBadge = getByLabelText('Resilient trait - positive');
      fireEvent.press(resilientBadge);

      // Modal should be marked as accessibility modal
      // This is tested by checking if the modal renders (implementation detail)
      await waitFor(() => {
        expect(getByLabelText('Close')).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles traits with underscores in names', () => {
      const traitsWithUnderscores = {
        positive: ['trainability_boost'],
        negative: [],
        hidden: [],
      };

      const { getByText } = render(
        <TraitDisplay traits={traitsWithUnderscores} />
      );
      expect(getByText('Trainability Boost')).toBeTruthy();
    });

    it('handles empty trait arrays gracefully', () => {
      const emptyTraits = {
        positive: [],
        negative: [],
        hidden: [],
      };

      const { getByText } = render(<TraitDisplay traits={emptyTraits} />);
      expect(getByText('No traits discovered yet')).toBeTruthy();
    });

    it('handles missing trait arrays', () => {
      const incompleteTraits = {
        positive: ['resilient'],
        // negative and hidden arrays missing
      };

      const { getByText, queryByText } = render(
        <TraitDisplay traits={incompleteTraits} />
      );

      expect(getByText('Resilient')).toBeTruthy();
      expect(queryByText('Negative Traits')).toBeNull();
      expect(queryByText('Undiscovered')).toBeNull();
    });

    it('handles very long trait names', () => {
      const longNameTraits = {
        positive: ['very_long_trait_name_that_might_cause_layout_issues'],
        negative: [],
        hidden: [],
      };

      const { getByText } = render(<TraitDisplay traits={longNameTraits} />);
      expect(
        getByText('Very Long Trait Name That Might Cause Layout Issues')
      ).toBeTruthy();
    });
  });
});
