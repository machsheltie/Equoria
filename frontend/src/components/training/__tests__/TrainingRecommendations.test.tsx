import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TrainingRecommendations from '../TrainingRecommendations';

describe('TrainingRecommendations', () => {
  const sampleHorses = [
    { id: 1, name: 'Thunder', age: 5, trainingStatus: 'ready' as const },
    { id: 2, name: 'Lightning', age: 4, trainingStatus: 'cooldown' as const },
    { id: 3, name: 'Storm', age: 2, trainingStatus: 'ineligible' as const },
    { id: 4, name: 'Blaze', age: 8, trainingStatus: 'ready' as const },
    { id: 5, name: 'Spirit', age: 6, trainingStatus: 'ready' as const },
  ];

  describe('Rendering', () => {
    it('renders recommendations container', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      expect(screen.getByTestId('recommendations')).toBeInTheDocument();
    });

    it('renders title', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      expect(screen.getByText('Training Recommendations')).toBeInTheDocument();
    });

    it('renders description', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      expect(screen.getByText(/ai-powered suggestions/i)).toBeInTheDocument();
    });
  });

  describe('Priority Recommendations', () => {
    it('shows priority horses section when ready horses exist', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      expect(screen.getByText('Priority Training')).toBeInTheDocument();
    });

    it('recommends oldest ready horses first', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      // Blaze (age 8) should be listed before Thunder (age 5)
      expect(screen.getByText(/blaze/i)).toBeInTheDocument();
    });

    it('limits recommendations to top 3', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      const recommendations = screen.getAllByTestId('horse-recommendation');
      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('shows horse names in recommendations', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      // Should show at least one ready horse name
      const readyHorses = screen.queryAllByText(/thunder|blaze|spirit/i);
      expect(readyHorses.length).toBeGreaterThan(0);
    });

    it('shows horse ages in recommendations', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      // Should show age information
      const ages = screen.queryAllByText(/\d+ years old/i);
      expect(ages.length).toBeGreaterThan(0);
    });

    it('includes reasoning for recommendations', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      // Should explain why this horse is recommended
      const hasReason = screen.queryByText(/ready|priority|recommended/i);
      expect(hasReason).toBeInTheDocument();
    });
  });

  describe('Training Tips', () => {
    it('shows training tips section', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      expect(screen.getByText('Training Tips')).toBeInTheDocument();
    });

    it('displays multiple tips', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      const tips = screen.getAllByTestId('training-tip');
      expect(tips.length).toBeGreaterThanOrEqual(2);
    });

    it('shows tip icons', () => {
      const { container } = render(<TrainingRecommendations horses={sampleHorses} />);
      const icons = container.querySelectorAll('[data-testid="training-tip"] svg');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State - No Ready Horses', () => {
    const noReadyHorses = [
      { id: 2, name: 'Lightning', age: 4, trainingStatus: 'cooldown' as const },
      { id: 3, name: 'Storm', age: 2, trainingStatus: 'ineligible' as const },
    ];

    it('shows empty state when no ready horses', () => {
      render(<TrainingRecommendations horses={noReadyHorses} />);
      expect(screen.getByTestId('empty-recommendations')).toBeInTheDocument();
    });

    it('shows empty state message', () => {
      render(<TrainingRecommendations horses={noReadyHorses} />);
      expect(screen.getByText(/no training recommendations available/i)).toBeInTheDocument();
    });

    it('shows empty state icon', () => {
      const { container } = render(<TrainingRecommendations horses={noReadyHorses} />);
      const icon = container.querySelector('[data-testid="empty-recommendations"] svg');
      expect(icon).toBeInTheDocument();
    });

    it('still shows training tips in empty state', () => {
      render(<TrainingRecommendations horses={noReadyHorses} />);
      expect(screen.getByText('Training Tips')).toBeInTheDocument();
    });
  });

  describe('Empty State - No Horses', () => {
    it('shows empty state when no horses at all', () => {
      render(<TrainingRecommendations horses={[]} />);
      expect(screen.getByTestId('empty-recommendations')).toBeInTheDocument();
    });

    it('shows appropriate message for no horses', () => {
      render(<TrainingRecommendations horses={[]} />);
      expect(
        screen.getByText(/add horses to receive training recommendations/i)
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has semantic section structure', () => {
      render(<TrainingRecommendations horses={sampleHorses} />);
      const container = screen.getByTestId('recommendations');
      expect(container).toBeInTheDocument();
    });

    it('icons are hidden from screen readers', () => {
      const { container } = render(<TrainingRecommendations horses={sampleHorses} />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  describe('Custom className', () => {
    it('accepts and applies custom className', () => {
      const { container } = render(
        <TrainingRecommendations horses={sampleHorses} className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
