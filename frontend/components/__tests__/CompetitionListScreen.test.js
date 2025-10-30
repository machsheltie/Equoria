/**
 * CompetitionListScreen Component Tests
 *
 * Tests for the React Native competition list screen including:
 * - Competition listing with FlatList
 * - Discipline-based filtering
 * - Search functionality
 * - Sorting options (date, prize pool, entry fee, entries)
 * - Competition status badges
 * - Pull-to-refresh functionality
 * - Empty states and loading states
 * - Error handling
 *
 * Following TDD with NO MOCKING approach for authentic component validation
 * Only infrastructure is mocked: AsyncStorage, Modal, ScrollView, Alert.alert
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import CompetitionListScreen from '../CompetitionListScreen.js';

// Mock infrastructure components (NOT business logic)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const RealScrollView = jest.requireActual('react-native/Libraries/Components/ScrollView/ScrollView');
  class ScrollViewMock extends RealScrollView {
    render() {
      return this.props.children;
    }
  }
  return ScrollViewMock;
});

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ visible, children }) => (visible ? <View>{children}</View> : null);
});

// Mock data for testing (real competition data structure)
const mockCompetitions = [
  {
    id: 1,
    name: 'Spring Racing Championship',
    description: 'Annual spring racing event with top prizes',
    discipline: 'Racing',
    date: '2025-11-15T14:00:00Z',
    entryDeadline: '2025-11-10T23:59:59Z',
    prizePool: 50000,
    entryFee: 500,
    maxEntries: 20,
    currentEntries: 15,
    status: 'open',
    requirements: {
      minAge: 3,
      maxAge: 10,
      minLevel: 5,
      requiredTraits: [],
    },
  },
  {
    id: 2,
    name: 'Elite Dressage Competition',
    description: 'High-level dressage competition for experienced horses',
    discipline: 'Dressage',
    date: '2025-11-20T10:00:00Z',
    entryDeadline: '2025-11-15T23:59:59Z',
    prizePool: 75000,
    entryFee: 750,
    maxEntries: 15,
    currentEntries: 12,
    status: 'open',
    requirements: {
      minAge: 4,
      maxAge: 12,
      minLevel: 7,
      requiredTraits: ['Elegant', 'Focused'],
    },
  },
  {
    id: 3,
    name: 'Show Jumping Grand Prix',
    description: 'Premier show jumping event with challenging courses',
    discipline: 'Show Jumping',
    date: '2025-12-01T13:00:00Z',
    entryDeadline: '2025-11-25T23:59:59Z',
    prizePool: 100000,
    entryFee: 1000,
    maxEntries: 25,
    currentEntries: 20,
    status: 'upcoming',
    requirements: {
      minAge: 5,
      maxAge: 15,
      minLevel: 8,
      requiredTraits: ['Athletic', 'Brave'],
    },
  },
  {
    id: 4,
    name: 'Western Pleasure Showcase',
    description: 'Traditional western pleasure competition',
    discipline: 'Western Pleasure',
    date: '2025-10-25T11:00:00Z',
    entryDeadline: '2025-10-20T23:59:59Z',
    prizePool: 30000,
    entryFee: 300,
    maxEntries: 30,
    currentEntries: 30,
    status: 'closed',
    requirements: {
      minAge: 3,
      maxAge: 12,
      minLevel: 4,
      requiredTraits: [],
    },
  },
  {
    id: 5,
    name: 'Summer Barrel Racing',
    description: 'Fast-paced barrel racing competition',
    discipline: 'Barrel Racing',
    date: '2025-10-15T15:00:00Z',
    entryDeadline: '2025-10-10T23:59:59Z',
    prizePool: 25000,
    entryFee: 250,
    maxEntries: 20,
    currentEntries: 18,
    status: 'completed',
    requirements: {
      minAge: 3,
      maxAge: 10,
      minLevel: 5,
      requiredTraits: ['Fast', 'Agile'],
    },
  },
];

const mockDisciplines = [
  'Racing',
  'Show Jumping',
  'Dressage',
  'Cross Country',
  'Western Pleasure',
  'Reining',
  'Cutting',
  'Barrel Racing',
  'Roping',
  'Team Penning',
  'Rodeo',
  'Hunter',
  'Saddleseat',
  'Endurance',
  'Eventing',
  'Vaulting',
  'Polo',
  'Combined Driving',
  'Fine Harness',
  'Gaited',
  'Gymkhana',
  'Steeplechase',
  'Harness Racing',
];

// Mock callbacks
const mockOnCompetitionPress = jest.fn();
const mockOnRefresh = jest.fn();

describe('CompetitionListScreen - Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders screen title', () => {
    render(
      <CompetitionListScreen
        competitions={mockCompetitions}
        disciplines={mockDisciplines}
        onCompetitionPress={mockOnCompetitionPress}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText(/competitions/i)).toBeTruthy();
  });

  test('renders loading state when isLoading is true', () => {
    render(
      <CompetitionListScreen
        competitions={[]}
        disciplines={mockDisciplines}
        isLoading={true}
        onCompetitionPress={mockOnCompetitionPress}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText(/loading competitions/i)).toBeTruthy();
  });

  test('renders empty state when no competitions available', () => {
    render(
      <CompetitionListScreen
        competitions={[]}
        disciplines={mockDisciplines}
        isLoading={false}
        onCompetitionPress={mockOnCompetitionPress}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText(/no competitions available/i)).toBeTruthy();
  });

  test('renders competition cards when competitions are provided', () => {
    render(
      <CompetitionListScreen
        competitions={mockCompetitions}
        disciplines={mockDisciplines}
        onCompetitionPress={mockOnCompetitionPress}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText('Spring Racing Championship')).toBeTruthy();
    expect(screen.getByText('Elite Dressage Competition')).toBeTruthy();
    expect(screen.getByText('Show Jumping Grand Prix')).toBeTruthy();
  });

  test('renders filter and sort buttons', () => {
    render(
      <CompetitionListScreen
        competitions={mockCompetitions}
        disciplines={mockDisciplines}
        onCompetitionPress={mockOnCompetitionPress}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByLabelText(/filter competitions/i)).toBeTruthy();
    expect(screen.getByLabelText(/sort competitions/i)).toBeTruthy();
  });
});

