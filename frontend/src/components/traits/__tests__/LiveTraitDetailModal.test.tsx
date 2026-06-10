/**
 * Tests: LiveTraitDetailModal (Equoria-vpgmc)
 *
 * The real-data trait detail dialog opened by clicking / keyboard-activating a
 * trait card. Verifies it renders description + valence and closes via the
 * GameDialog (Radix Dialog) close affordance. Fed by the HorseTrait view model
 * (no fixtures).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import LiveTraitDetailModal from '../LiveTraitDetailModal';
import type { HorseTrait } from '@/hooks/useHorseTraits';

const positiveTrait: HorseTrait = {
  key: 'resilient',
  name: 'Resilient',
  valence: 'positive',
  description: 'Less likely to be affected by stress.',
  rarity: 'common',
  category: 'epigenetic',
};

const negativeTrait: HorseTrait = {
  key: 'nervous',
  name: 'Nervous',
  valence: 'negative',
  description: 'Easily startled by new situations.',
};

describe('LiveTraitDetailModal', () => {
  it('renders nothing when trait is null', () => {
    const { container } = render(
      <LiveTraitDetailModal isOpen={false} onClose={() => {}} trait={null} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders trait name, description and a Beneficial banner for a positive trait', () => {
    render(<LiveTraitDetailModal isOpen onClose={() => {}} trait={positiveTrait} />);
    expect(screen.getByText('Less likely to be affected by stress.')).toBeInTheDocument();
    expect(screen.getByTestId('trait-detail-valence')).toHaveTextContent('Beneficial Trait');
    // name appears in the GameDialog title
    expect(screen.getAllByText('Resilient').length).toBeGreaterThan(0);
  });

  it('renders a Detrimental banner for a negative trait', () => {
    render(<LiveTraitDetailModal isOpen onClose={() => {}} trait={negativeTrait} />);
    expect(screen.getByTestId('trait-detail-valence')).toHaveTextContent('Detrimental Trait');
  });

  it('falls back to a placeholder when description is empty', () => {
    render(
      <LiveTraitDetailModal
        isOpen
        onClose={() => {}}
        trait={{ ...negativeTrait, description: '' }}
      />
    );
    expect(screen.getByText(/no description available/i)).toBeInTheDocument();
  });

  it('invokes onClose via the Escape key (Radix Dialog keyboard handling)', () => {
    const onClose = vi.fn();
    render(<LiveTraitDetailModal isOpen onClose={onClose} trait={positiveTrait} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
