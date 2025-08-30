/**
 * React Native Mock for Jest Testing
 * 
 * Provides mock implementations of React Native components and APIs
 * for testing React Native components in a Jest environment.
 */

import React from 'react';

// Mock React Native components as simple div elements
const mockComponent = (name) => {
  const Component = React.forwardRef((props, ref) => {
    return React.createElement('div', { ...props, ref, 'data-testid': name });
  });
  Component.displayName = name;
  return Component;
};

// Mock React Native API
export const StyleSheet = {
  create: jest.fn((styles) => styles),
  compose: jest.fn((style1, style2) => [style1, style2]),
  flatten: jest.fn((style) => style),
  absoluteFill: {},
  absoluteFillObject: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
};

export const Platform = {
  OS: 'ios',
  Version: '14.0',
  select: jest.fn((obj) => obj.ios || obj.default),
  isPad: false,
  isTVOS: false,
};

export const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 667 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Mock React Native components
export const View = mockComponent('View');
export const Text = mockComponent('Text');
export const ScrollView = mockComponent('ScrollView');
export const TouchableOpacity = mockComponent('TouchableOpacity');
export const TouchableHighlight = mockComponent('TouchableHighlight');
export const TouchableWithoutFeedback = mockComponent('TouchableWithoutFeedback');
export const Pressable = mockComponent('Pressable');
export const Image = mockComponent('Image');
export const TextInput = mockComponent('TextInput');
export const Modal = mockComponent('Modal');
export const SafeAreaView = mockComponent('SafeAreaView');
export const FlatList = mockComponent('FlatList');
export const SectionList = mockComponent('SectionList');

// Mock other React Native APIs
export const Alert = {
  alert: jest.fn(),
};

export const Animated = {
  View: mockComponent('AnimatedView'),
  Text: mockComponent('AnimatedText'),
  Value: jest.fn(() => ({ setValue: jest.fn() })),
  timing: jest.fn(() => ({ start: jest.fn() })),
  spring: jest.fn(() => ({ start: jest.fn() })),
  decay: jest.fn(() => ({ start: jest.fn() })),
  sequence: jest.fn(),
  parallel: jest.fn(),
  stagger: jest.fn(),
  loop: jest.fn(),
};

export const Easing = {
  linear: jest.fn(),
  ease: jest.fn(),
  quad: jest.fn(),
  cubic: jest.fn(),
};

// Default export for compatibility
export default {
  StyleSheet,
  Platform,
  Dimensions,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableHighlight,
  TouchableWithoutFeedback,
  Pressable,
  Image,
  TextInput,
  Modal,
  SafeAreaView,
  FlatList,
  SectionList,
  Alert,
  Animated,
  Easing,
};
