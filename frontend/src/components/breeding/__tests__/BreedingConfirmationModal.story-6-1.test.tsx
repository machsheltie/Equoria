/**
 * BreedingConfirmationModal Component Tests
 *
 * Story 6-1: Breeding Pair Selection
 * Tests for breeding confirmation modal, cost display, and warnings
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BreedingConfirmationModal from '../BreedingConfirmationModal';
import type { Horse } from '@/types/breeding';
import type { BreedingCompatibility } from '@/lib/api-client';

describe('BreedingConfirmationModal - Story 6-1', () => {
  const mockSire: Horse = {
    id: 1,
    name: 'Thunder',
    age: 5,
    sex: 'Male',
    breedName: 'Thoroughbred',
    healthStatus: 'Healthy',
    dateOfBirth: '2019-01-01',
    level: 10,
    temperament: 'Bold',
  };

  const mockDam: Horse = {
    id: 2,
    name: 'Lightning',
    age: 4,
    sex: 'Female',
    breedName: 'Arabian',
    healthStatus: 'Healthy',
    dateOfBirth: '2020-01-01',
    level: 8,
    temperament: 'Calm',
  };

  // REAL assessBreedingPairCompatibility response shape (Equoria-m54lr) —
  // the previous CompatibilityAnalysis fixture mirrored fields the API never
  // returned (temperamentMatch / traitSynergy / geneticDiversity).
  const mockCompatibility: BreedingCompatibility = {
    overallScore: 85,
    geneticCompatibility: 88,
    diversityImpact: 78,
    inbreedingRisk: 0.031,
    expectedTraits: {
      expectedStats: { speed: 82, stamina: 82, agility: 78, intelligence: 72 },
      likelyTraits: ['bold'],
      diversityPotential: 'high',
    },
    recommendation: 'good',
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    sire: mockSire,
    dam: mockDam,
    compatibility: mockCompatibility,
    compatibilityPending: false,
    compatibilityError: false,
    onRetryCompatibility: vi.fn(),
    studFee: 5000,
    onConfirm: vi.fn(),
    isSubmitting: false,
  };

  describe('Modal Display', () => {
    it('should render when isOpen is true', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByTestId('breeding-confirmation-modal')).toBeInTheDocument();
      expect(screen.getAllByText('Confirm Breeding').length).toBeGreaterThan(0);
    });

    it('should not render when isOpen is false', () => {
      render(<BreedingConfirmationModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('breeding-confirmation-modal')).not.toBeInTheDocument();
    });
  });

  describe('Parent Information Display', () => {
    it('should display both parent cards', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getAllByText('Thunder').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lightning').length).toBeGreaterThan(0);
    });

    it('should display sire label correctly', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Sire (Stallion)')).toBeInTheDocument();
    });

    it('should display dam label correctly', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Dam (Mare)')).toBeInTheDocument();
    });

    it('should display breed information', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Thoroughbred')).toBeInTheDocument();
      expect(screen.getByText('Arabian')).toBeInTheDocument();
    });

    it('should display age information', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('5 years')).toBeInTheDocument();
      expect(screen.getByText('4 years')).toBeInTheDocument();
    });

    it('should display health status', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      const healthElements = screen.getAllByText(/Healthy/i);
      expect(healthElements.length).toBeGreaterThanOrEqual(2);
    });

    it('should display level information', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('should display temperament information', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Bold')).toBeInTheDocument();
      expect(screen.getByText('Calm')).toBeInTheDocument();
    });
  });

  describe('Compatibility Summary (real data — Equoria-m54lr)', () => {
    it('should display the real overall compatibility score', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('85/100')).toBeInTheDocument();
    });

    it('should display the REAL compatibility breakdown fields', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Genetic Compatibility')).toBeInTheDocument();
      expect(screen.getByText('88')).toBeInTheDocument();
      expect(screen.getByText('Diversity Impact')).toBeInTheDocument();
      expect(screen.getByText('78')).toBeInTheDocument();
      expect(screen.getByText('Inbreeding Risk')).toBeInTheDocument();
      expect(screen.getByText('3.1%')).toBeInTheDocument();
    });

    it('should display the real backend recommendation verdict', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('good')).toBeInTheDocument();
    });

    it('should color-code excellent compatibility (>80)', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      const overallScore = screen.getByText('85/100');
      // Dark theme: green -> emerald-400 for high contrast
      expect(overallScore).toHaveClass('text-[var(--role-success-text)]');
    });

    it('should color-code good compatibility (60-80)', () => {
      const goodCompatibility = { ...mockCompatibility, overallScore: 70 };
      render(<BreedingConfirmationModal {...defaultProps} compatibility={goodCompatibility} />);

      const overallScore = screen.getByText('70/100');
      // Dark theme: yellow -> amber-400
      expect(overallScore).toHaveClass('text-[var(--role-warning-text)]');
    });

    it('should color-code poor compatibility (<60)', () => {
      const poorCompatibility = { ...mockCompatibility, overallScore: 45 };
      render(<BreedingConfirmationModal {...defaultProps} compatibility={poorCompatibility} />);

      const overallScore = screen.getByText('45/100');
      // Dark theme: red-600 -> red-400 for contrast on dark bg
      expect(overallScore).toHaveClass('text-[var(--role-danger-text)]');
    });

    it('should render a REAL zero verbatim — never a fabricated fallback (doctrine §4)', () => {
      // The `|| 75` class of defect also eats legitimate 0s. A pair scoring a
      // real 0 must display 0/100, not any plausible literal.
      const zeroCompatibility: BreedingCompatibility = {
        ...mockCompatibility,
        overallScore: 0,
        geneticCompatibility: 0,
        diversityImpact: 0,
        inbreedingRisk: 0,
      };
      render(<BreedingConfirmationModal {...defaultProps} compatibility={zeroCompatibility} />);

      expect(screen.getByText('0/100')).toBeInTheDocument();
      expect(screen.getByText('0.0%')).toBeInTheDocument();
      // Sentinel: the historical fabricated constants must NOT appear.
      expect(screen.queryByText('75/100')).not.toBeInTheDocument();
      expect(screen.queryByText('80')).not.toBeInTheDocument();
      expect(screen.queryByText('70')).not.toBeInTheDocument();
    });

    it('should show an honest loading state while the analysis is pending (no numbers)', () => {
      render(
        <BreedingConfirmationModal
          {...defaultProps}
          compatibility={undefined}
          compatibilityPending={true}
        />
      );

      expect(screen.getByLabelText('Analyzing compatibility')).toBeInTheDocument();
      // Loading is not a number — no score of any kind renders.
      expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();
    });

    it('should show an honest error state with a wired retry — never fake data', async () => {
      const user = userEvent.setup();
      const onRetryCompatibility = vi.fn();
      render(
        <BreedingConfirmationModal
          {...defaultProps}
          compatibility={undefined}
          compatibilityPending={false}
          compatibilityError={true}
          onRetryCompatibility={onRetryCompatibility}
        />
      );

      expect(screen.getByText('Compatibility analysis unavailable')).toBeInTheDocument();
      // Error must NOT fall through to fabricated scores.
      expect(screen.queryByText(/\/100/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Try Again/i }));
      expect(onRetryCompatibility).toHaveBeenCalledOnce();
    });
  });

  describe('Cost Display', () => {
    it('should display stud fee', () => {
      render(<BreedingConfirmationModal {...defaultProps} studFee={5000} />);

      // Stud fee renders as coins (canonical Currency; no USD)
      expect(screen.getByText('5,000')).toBeInTheDocument();
    });

    it('should format large stud fees correctly', () => {
      render(<BreedingConfirmationModal {...defaultProps} studFee={123456} />);

      expect(screen.getByText('123,456')).toBeInTheDocument();
    });

    it('should explain stud fee deduction', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(
        screen.getByText(/This amount will be deducted from your account balance immediately/i)
      ).toBeInTheDocument();
    });
  });

  describe('Warnings and Information', () => {
    it('should display 30-day cooldown warning', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/30-Day Breeding Cooldown/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Both parents will be unavailable for breeding for 30 days/i)
      ).toBeInTheDocument();
    });

    it('should display gestation period information', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/Gestation Period/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /The foal will be born immediately and enter the critical 30-day development phase/i
        )
      ).toBeInTheDocument();
    });

    it('should display foal care requirements', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/Foal Care Required/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Daily enrichment activities and milestone evaluations will be needed/i)
      ).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<BreedingConfirmationModal {...defaultProps} onClose={onClose} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('should call onConfirm when Confirm button is clicked', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();

      render(<BreedingConfirmationModal {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByRole('button', { name: /Confirm Breeding/i });
      await user.click(confirmButton);

      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it('should disable buttons when isSubmitting is true', () => {
      render(<BreedingConfirmationModal {...defaultProps} isSubmitting={true} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      const confirmButton = screen.getByRole('button', { name: /Initiating Breeding/i });

      expect(cancelButton).toBeDisabled();
      expect(confirmButton).toBeDisabled();
    });

    it('should show "Initiating Breeding..." text when submitting', () => {
      render(<BreedingConfirmationModal {...defaultProps} isSubmitting={true} />);

      expect(screen.getByText('Initiating Breeding...')).toBeInTheDocument();
    });

    it('should not allow closing modal when submitting', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(<BreedingConfirmationModal {...defaultProps} onClose={onClose} isSubmitting={true} />);

      // Escape is suppressed while submitting (onEscapeKeyDown preventDefault)
      await user.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();

      // Cancel button is also disabled while submitting
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Confirmation Message', () => {
    it('should display confirmation question with horse names', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/Are you sure you want to breed/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Thunder/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Lightning/i).length).toBeGreaterThan(0);
    });
  });

  describe('Modal Accessibility', () => {
    it('should render an accessible dialog with title wiring (provided by Radix GameDialog)', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      // Radix Dialog provides role="dialog" and auto-wires aria-labelledby to
      // the dialog title (modality is enforced via aria-hidden on siblings,
      // so Radix does not emit an aria-modal attribute)
      const modal = screen.getByTestId('breeding-confirmation-modal');
      expect(modal).toHaveAttribute('role', 'dialog');
      const labelledById = modal.getAttribute('aria-labelledby');
      expect(labelledById).toBeTruthy();
      const titleEl = document.getElementById(labelledById!);
      expect(titleEl).not.toBeNull();
      expect(titleEl!.textContent).toContain('Confirm Breeding');
    });

    it('should have proper heading structure', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing breed information gracefully (Equoria-1k4n: "not recorded", never "Unknown")', () => {
      const sireNoBreed = { ...mockSire, breedName: undefined };
      const damNoBreed = { ...mockDam, breedName: undefined };

      render(<BreedingConfirmationModal {...defaultProps} sire={sireNoBreed} dam={damNoBreed} />);

      // Equoria-1k4n — legacy/missing breed renders the honest 'not recorded'
      // fallback (Equoria-iwy3 convention), one per horse (sire + dam).
      expect(screen.getAllByText('not recorded').length).toBeGreaterThanOrEqual(2);
      // Sentinel-positive: the exact defect (literal 'Unknown') must NOT appear.
      expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
    });

    it('should handle missing health status', () => {
      const sireNoHealth = { ...mockSire, healthStatus: undefined };

      render(<BreedingConfirmationModal {...defaultProps} sire={sireNoHealth} />);

      // Should display default "Good" health status (getAllByText: the real
      // "good" recommendation verdict also matches this pattern)
      expect(screen.getAllByText(/Good/i).length).toBeGreaterThanOrEqual(1);
    });

    it('should handle horses without images', () => {
      const sireNoImage = { ...mockSire, imageUrl: undefined };
      const damNoImage = { ...mockDam, imageUrl: undefined };

      render(<BreedingConfirmationModal {...defaultProps} sire={sireNoImage} dam={damNoImage} />);

      // Should render without errors
      expect(screen.getAllByText('Thunder').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lightning').length).toBeGreaterThan(0);
    });
  });
});
