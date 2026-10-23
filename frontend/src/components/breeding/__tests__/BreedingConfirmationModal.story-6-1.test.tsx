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
    sex: 'Stallion',
    breedName: 'Thoroughbred',
    healthStatus: 'Healthy',
    displayedHealth: 'Very Good',
    dateOfBirth: '2019-01-01',
    level: 10,
    temperament: 'Bold',
  };

  const mockDam: Horse = {
    id: 2,
    name: 'Lightning',
    age: 4,
    sex: 'Mare',
    breedName: 'Arabian',
    healthStatus: 'Healthy',
    displayedHealth: 'Very Good',
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

    // Owner ruling 2026-10-23 (Equoria-u0jop): health shows as the server's
    // displayed health in the five words. Old contract: the raw healthStatus.
    it('should display health status', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      const healthElements = screen.getAllByTestId('breeding-horse-health');
      expect(healthElements.map((el) => el.textContent)).toEqual(['Very Good', 'Very Good']);
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

  // Contract changed by the owner (Equoria-q4uem.9). OLD: the dialog showed a
  // caller-computed stud fee "deducted immediately" and warned of a 30-day
  // cooldown on BOTH parents. NEW (Stacey, 2026-10-02 / 10-12 / 10-16): this
  // dialog confirms an own pair, which is free; the cooldown is the mare's
  // alone (one game year), and stallions have none.
  describe('Cost Display', () => {
    it('states that an own pair has no stud fee', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText('None')).toBeInTheDocument();
      expect(
        screen.getByText('Both horses are yours, and breeding your own pair is free.')
      ).toBeInTheDocument();
      expect(screen.queryByText(/deducted from your account balance/i)).not.toBeInTheDocument();
    });
  });

  describe('Warnings and Information', () => {
    it('warns of the mare-only cooldown', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/Breeding Cooldown:/)).toBeInTheDocument();
      expect(
        screen.getByText(/Lightning rests from breeding for one game year after this breeding/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Thunder has no cooldown/)).toBeInTheDocument();
      expect(screen.queryByText(/30-Day Breeding Cooldown/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Both parents/i)).not.toBeInTheDocument();
    });

    // Contract changed by the owner (Equoria-7ga54). OLD: "the foal will be born
    // immediately and enter the critical 30-day development phase" and the
    // player must do "daily enrichment activities and milestone evaluations".
    // NEW (Stacey): a pregnancy lasts 7 days (2026-10-12); grooms do a foal's
    // enrichment until age 3, one activity a day that the player chooses, with
    // no graduation or milestones (2026-10-14 / 10-15).
    it('states the 7-day pregnancy', () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/Pregnancy:/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Lightning will be in foal for 7 days; the foal is born on the seventh night/
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/born immediately/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/30-day development/i)).not.toBeInTheDocument();
    });

    it("says the foal's groom does its enrichment", () => {
      render(<BreedingConfirmationModal {...defaultProps} />);

      expect(screen.getByText(/Raising the Foal:/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Until the foal is 3, its groom does its enrichment: one activity a day, chosen by you/
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/milestone evaluations/i)).not.toBeInTheDocument();
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

    // Old contract: a missing health printed an invented "Good". Unknown is an
    // em dash, never a reassuring fake word (PRODUCT.md; Equoria-u0jop).
    it('should handle missing health status', () => {
      const sireNoHealth = { ...mockSire, healthStatus: undefined, displayedHealth: undefined };

      render(<BreedingConfirmationModal {...defaultProps} sire={sireNoHealth} />);

      const healthElements = screen.getAllByTestId('breeding-horse-health');
      expect(healthElements.map((el) => el.textContent)).toEqual(['—', 'Very Good']);
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
