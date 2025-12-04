import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect } from 'vitest';
import TrainingHistoryPanel from '../TrainingHistoryPanel';

vi.mock('@/hooks/api/useTraining', () => ({
  useTrainingOverview: () => ({
    data: [
      { discipline: 'dressage', score: 42, nextEligibleDate: null },
      { discipline: 'racing', score: 55, nextEligibleDate: '2025-12-10T00:00:00Z' },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/api/useHorses', () => ({
  useHorseTrainingHistory: () => ({
    data: [
      { id: 1, discipline: 'dressage', score: 40, trainedAt: '2025-12-01T00:00:00Z' },
      { id: 2, discipline: 'racing', score: 55, trainedAt: '2025-12-02T00:00:00Z' },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('TrainingHistoryPanel', () => {
  it('shows prompt when no horse selected', () => {
    render(<TrainingHistoryPanel />);
    expect(screen.getByText(/Select a horse/i)).toBeInTheDocument();
  });

  it('renders discipline status and history entries', () => {
    render(<TrainingHistoryPanel horseId={1} />);

    expect(screen.getByText(/Discipline Status/)).toBeInTheDocument();
    // Discipline names appear in both status and history, so we use getAllByText
    expect(screen.getAllByText(/dressage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/racing/i).length).toBeGreaterThan(0);

    expect(screen.getByText(/Training History/)).toBeInTheDocument();
    // History dates are formatted by locale, check for year presence
    expect(screen.getAllByText(/2025/).length).toBeGreaterThan(0);
  });
});
