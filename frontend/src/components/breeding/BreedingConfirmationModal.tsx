/**
 * BreedingConfirmationModal Component
 *
 * Confirmation modal for breeding pair selection.
 * Displays both parent details, compatibility summary, cost breakdown, and warnings.
 *
 * Story 6-1: Breeding Pair Selection - Subcomponent
 *
 * Migrated from BaseModal → GameDialog (Equoria-o5hub.13, DECISIONS.md §8).
 * Focus trap, Escape close, scroll-lock, and focus restoration are provided
 * by Radix Dialog — not re-implemented here. While isSubmitting, Escape and
 * outside-click dismissal are suppressed (parity with BaseModal's
 * closeOnEscape/closeOnBackdropClick={!isSubmitting}).
 */

import React from 'react';
import { Heart, AlertTriangle, Coins, Clock, TrendingUp } from 'lucide-react';
import Currency from '@/components/ui/Currency';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogBody,
  GameDialogFooter,
} from '@/components/ui/game/GameDialog';
import { Button } from '@/components/ui/button';
import type { Horse, CompatibilityAnalysis } from '@/types/breeding';
import { getHorseImage } from '@/lib/breed-images';

export interface BreedingConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sire: Horse;
  dam: Horse;
  compatibility: CompatibilityAnalysis;
  studFee: number;
  onConfirm: () => void;
  isSubmitting: boolean;
}

/**
 * Horse Info Card
 */
interface HorseCardProps {
  horse: Horse;
  type: 'sire' | 'dam';
}

const HorseCard: React.FC<HorseCardProps> = ({ horse, type }) => {
  const colorClass =
    type === 'sire'
      ? 'border-[var(--role-info-border)] bg-[var(--role-info-bg)]'
      : 'border-[var(--badge-rare-bg)] bg-[var(--badge-rare-bg)]';
  const labelColor = type === 'sire' ? 'text-[var(--role-info-text)]' : 'text-[var(--status-rare)]';
  const label = type === 'sire' ? 'Sire (Stallion)' : 'Dam (Mare)';

  return (
    <div className={`rounded-lg border ${colorClass} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{label}</p>
          <h4 className="text-lg font-bold text-[var(--text-primary)] mt-1">{horse.name}</h4>
        </div>
        <img
          src={getHorseImage(horse.imageUrl, horse.breedName)}
          alt={horse.name}
          className="h-12 w-12 rounded-full object-cover border-2 border-[var(--glass-border)] shadow-sm"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
          }}
        />
      </div>

      <div className="space-y-2 text-sm">
        {/* Breed & Age */}
        <div className="flex items-center justify-between">
          <span className="text-role-secondary">Breed:</span>
          <span className="font-medium text-[var(--text-primary)]">
            {/* Equoria-1k4n — legacy horses may lack breedName; 'not recorded'
                is the honest fallback per the Equoria-iwy3 convention (never
                render the literal 'Unknown' for missing data). */}
            {horse.breedName || 'not recorded'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-role-secondary">Age:</span>
          <span className="font-medium text-[var(--text-primary)]">{horse.age} years</span>
        </div>

        {/* Health Status */}
        <div className="flex items-center justify-between">
          <span className="text-role-secondary">Health:</span>
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3 text-[var(--status-danger)]" />
            <span className="font-medium text-[var(--text-primary)] capitalize">
              {horse.healthStatus || 'Good'}
            </span>
          </div>
        </div>

        {/* Level (if available) */}
        {horse.level !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-role-secondary">Level:</span>
            <span className="font-medium text-[var(--text-primary)]">{horse.level}</span>
          </div>
        )}

        {/* Temperament (if available) */}
        {horse.temperament && (
          <div className="flex items-center justify-between">
            <span className="text-role-secondary">Temperament:</span>
            <span className="font-medium text-[var(--text-primary)] capitalize">
              {horse.temperament}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * BreedingConfirmationModal Component
 */
const BreedingConfirmationModal: React.FC<BreedingConfirmationModalProps> = ({
  isOpen,
  onClose,
  sire,
  dam,
  compatibility,
  studFee,
  onConfirm,
  isSubmitting,
}) => {
  // Get compatibility color
  const compatibilityColor =
    compatibility.overall >= 80
      ? 'text-[var(--role-success-text)]'
      : compatibility.overall >= 60
        ? 'text-[var(--role-warning-text)]'
        : 'text-[var(--role-danger-text)]';

  return (
    <GameDialog
      open={isOpen}
      onOpenChange={(open) => {
        // Only allow closing if not submitting (BaseModal isSubmitting parity)
        if (!open && !isSubmitting) {
          onClose();
        }
      }}
    >
      <GameDialogContent
        size="lg"
        data-testid="breeding-confirmation-modal"
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <GameDialogHeader>
          <GameDialogTitle>Confirm Breeding</GameDialogTitle>
          <GameDialogDescription>
            Review the breeding pair details before confirming
          </GameDialogDescription>
        </GameDialogHeader>

        <GameDialogBody>
          <div className="space-y-6 pt-2">
            {/* Parent Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <HorseCard horse={sire} type="sire" />
              <HorseCard horse={dam} type="dam" />
            </div>

            {/* Compatibility Summary */}
            <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-role-secondary" />
                  <h5 className="text-sm font-semibold text-[var(--text-primary)]">
                    Compatibility Score
                  </h5>
                </div>
                <span className={`text-2xl font-bold ${compatibilityColor}`}>
                  {compatibility.overall}/100
                </span>
              </div>

              {/* Compatibility Breakdown */}
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div className="text-center">
                  <p className="text-role-secondary">Temperament</p>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {compatibility.temperamentMatch}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-role-secondary">Trait Synergy</p>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {compatibility.traitSynergy}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-role-secondary">Genetic Diversity</p>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {compatibility.geneticDiversity}
                  </p>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="rounded-lg border border-[var(--role-success-border)] bg-[var(--role-success-bg)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-[var(--role-success-text)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Stud Fee</span>
                </div>
                <span className="text-xl font-bold text-[var(--role-success-text)]">
                  <Currency amount={studFee} showIcon={false} />
                </span>
              </div>
              <p className="text-xs text-role-secondary mt-2">
                This amount will be deducted from your account balance immediately.
              </p>
            </div>

            {/* Important Warnings */}
            <div className="rounded-lg border border-[var(--role-warning-border)] bg-[var(--role-warning-bg)] p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-[var(--role-warning-text)] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h5 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Important Information
                  </h5>
                  <ul className="space-y-2 text-sm text-[var(--role-warning-text)]">
                    <li className="flex items-start gap-2">
                      <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>30-Day Breeding Cooldown:</strong> Both parents will be unavailable
                        for breeding for 30 days after confirmation.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-[var(--role-warning-text)] flex-shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Gestation Period:</strong> The foal will be born immediately and
                        enter the critical 30-day development phase.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-[var(--role-warning-text)] flex-shrink-0">
                        •
                      </span>
                      <span>
                        <strong>Foal Care Required:</strong> Daily enrichment activities and
                        milestone evaluations will be needed during the foal's development.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Confirmation Message */}
            <div className="text-center py-2">
              <p className="text-sm text-[var(--text-primary)]">
                Are you sure you want to breed <strong>{sire.name}</strong> and{' '}
                <strong>{dam.name}</strong>?
              </p>
            </div>
          </div>
        </GameDialogBody>

        <GameDialogFooter>
          {/* Action hierarchy (DECISIONS.md §5): Cancel = secondary; one gold primary */}
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Initiating Breeding...' : 'Confirm Breeding'}
          </Button>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};

export default BreedingConfirmationModal;
