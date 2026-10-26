/**
 * DisciplineScoreColumns: one column per discipline family, each scored
 * discipline with its name and score number, zeros on one quiet line.
 * Owner ruling 2026-10-26 (q97): no bars, horseshoes or laurels; scores are
 * uncapped (ruling 2026-10-07). Old contract: a Recharts radar with a 0-100
 * style axis (Equoria-ycivq).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import DisciplineScoreColumns from '../DisciplineScoreColumns';

describe('DisciplineScoreColumns', () => {
  it('lists each scored discipline with its name and number in its family column', () => {
    render(<DisciplineScoreColumns disciplineScores={{ dressage: 45, reining: 12 }} />);
    const english = screen.getByTestId('score-family-English');
    expect(within(english).getByText('Dressage')).toBeInTheDocument();
    expect(within(english).getByText('45')).toBeInTheDocument();
    const western = screen.getByTestId('score-family-Western');
    expect(within(western).getByText('Reining')).toBeInTheDocument();
    expect(within(western).getByText('12')).toBeInTheDocument();
    expect(within(western).queryByText('Dressage')).toBeNull();
  });

  it('shows four family columns', () => {
    render(<DisciplineScoreColumns disciplineScores={{}} />);
    for (const family of ['Western', 'English', 'Specialized', 'Racing']) {
      expect(screen.getByTestId(`score-family-${family}`)).toBeInTheDocument();
    }
  });

  it('shares one quiet line for disciplines still at zero, not one row each', () => {
    render(<DisciplineScoreColumns disciplineScores={{ dressage: 45 }} />);
    const line = screen.getByTestId('score-family-English-unscored');
    expect(line).toHaveTextContent(/not yet scored/i);
    expect(line).toHaveTextContent('Show Jumping');
    expect(line).not.toHaveTextContent('Dressage');
    expect(screen.queryByText('0')).toBeNull();
  });

  it('prints large uncapped scores in full, with no axis, bars or ceiling', () => {
    const { container } = render(<DisciplineScoreColumns disciplineScores={{ dressage: 12345 }} />);
    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).not.toMatch(/0 to 100|\/ ?100/);
  });
});
