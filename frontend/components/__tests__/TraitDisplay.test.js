import React from 'react';

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

  describe('Basic Tests', () => {
    it('should import TraitDisplay component', () => {
      expect(TraitDisplay).toBeDefined();
      expect(typeof TraitDisplay).toBe('function');
    });

    it('should create component without crashing', () => {
      expect(() => {
        React.createElement(TraitDisplay, defaultProps);
      }).not.toThrow();
    });

  });
});
