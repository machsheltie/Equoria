/**
 * Expo Linear Gradient Mock for Jest Testing
 * 
 * Provides mock implementation of expo-linear-gradient for testing.
 */

import React from 'react';

export const LinearGradient = React.forwardRef((props, ref) => {
  const { children, colors, start, end, locations, ...otherProps } = props;
  
  return React.createElement(
    'div',
    {
      ...otherProps,
      ref,
      'data-testid': 'LinearGradient',
      'data-colors': colors?.join(','),
      'data-start': start ? `${start.x},${start.y}` : undefined,
      'data-end': end ? `${end.x},${end.y}` : undefined,
      'data-locations': locations?.join(','),
    },
    children
  );
});

LinearGradient.displayName = 'LinearGradient';

export default {
  LinearGradient,
};
