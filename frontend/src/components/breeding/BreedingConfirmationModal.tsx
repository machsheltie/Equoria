/**
 * BreedingConfirmationModal Component
 *
 * Confirmation modal for breeding pair selection.
 * Displays both parent details, compatibility summary, cost breakdown, and warnings.
 * Uses BaseModal for consistent modal behavior and accessibility.
 *
 * Story 6-1: Breeding Pair Selection - Subcomponent
 */

import React from 'react';
import BaseModal from '@/components/common/BaseModal';
import { Heart, AlertTriangle, DollarSign, Clock, TrendingUp } from 'lucide-react';
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
      ? 'border-blue-500/30 bg-[rgba(37,99,235,0.1)]'
      : 'border-purple-500/30 bg-[rgba(147,51,234,0.1)]';
  const labelColor = type === 'sire' ? 'text-blue-400' : 'text-purple-400';
  const label = type === 'sire' ? 'Sire (Stallion)' : 'Dam (Mare)';

  return (
    <div className={`rounded-lg border ${colorClass} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${labelColor}`}>{label}</p>
          <h4 className="text-lg font-bold text-[rgb(220,235,255)] mt-1">{horse.name}</h4>
        </div>
        <img
          src={getHorseImage(horse.imageUrl, horse.breedName)}
          alt={horse.name}
          className="h-12 w-12 rounded-full object-cover border-2 border-[rgba(37,99,235,0.3)] shadow-sm"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/horse-placeholder.png';
          }}
        />
      </div>

      <div className="space-y-2 text-sm">
        {/* Breed & Age */}
        <div className="flex items-center justify-between">
          <span className="text-[rgb(148,163,184)]">Breed:</span>
          <span className="font-medium text-[rgb(220,235,255)]">
            {horse.breedName || 'Unknown'}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[rgb(148,163,184)]">Age:</span>
          <span className="font-medium text-[rgb(220,235,255)]">{horse.age} years</span>
        </div>

        {/* Health Status */}
        <div className="flex items-center justify-between">
          <span className="text-[rgb(148,163,184)]">Health:</span>
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3 text-red-500" />
            <span className="font-medium text-[rgb(220,235,255)] capitalize">
              {horse.healthStatus || 'Good'}
            </span>
          </div>
        </div>

        {/* Level (if available) */}
        {horse.level !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-[rgb(148,163,184)]">Level:</span>
            <span className="font-medium text-[rgb(220,235,255)]">{horse.level}</span>
          </div>
        )}

        {/* Temperament (if available) */}
        {horse.temperament && (
          <div className="flex items-center justify-between">
            <span className="text-[rgb(148,163,184)]">Temperament:</span>
            <span className="font-medium text-[rgb(220,235,255)] capitalize">
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
      ? 'text-emerald-400'
      : compatibility.overall >= 60
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Breeding"
      size="lg"
      isSubmitting={isSubmitting}
      closeOnEscape={!isSubmitting}
      closeOnBackdropClick={!isSubmitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-[rgb(220,235,255)] bg-[rgba(15,35,70,0.4)] border border-[rgba(37,99,235,0.3)] rounded-md hover:bg-[rgba(37,99,235,0.08)] focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-transparent rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Initiating Breeding...' : 'Confirm Breeding'}
          </button>
        </>
      }
      data-testid="breeding-confirmation-modal"
    >
      <div className="space-y-6">
        {/* Parent Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <HorseCard horse={sire} type="sire" />
          <HorseCard horse={dam} type="dam" />
        </div>

        {/* Compatibility Summary */}
        <div className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[rgb(148,163,184)]" />
              <h5 className="text-sm font-semibold text-[rgb(220,235,255)]">Compatibility Score</h5>
            </div>
            <span className={`text-2xl font-bold ${compatibilityColor}`}>
              {compatibility.overall}/100
            </span>
          </div>

          {/* Compatibility Breakdown */}
          <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
            <div className="text-center">
              <p className="text-[rgb(148,163,184)]">Temperament</p>
              <p className="font-semibold text-[rgb(220,235,255)]">
                {compatibility.temperamentMatch}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[rgb(148,163,184)]">Trait Synergy</p>
              <p className="font-semibold text-[rgb(220,235,255)]">{compatibility.traitSynergy}</p>
            </div>
            <div className="text-center">
              <p className="text-[rgb(148,163,184)]">Genetic Diversity</p>
              <p className="font-semibold text-[rgb(220,235,255)]">
                {compatibility.geneticDiversity}
              </p>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="rounded-lg border border-emerald-500/30 bg-[rgba(16,185,129,0.1)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-semibold text-[rgb(220,235,255)]">Stud Fee</span>
            </div>
            <span className="text-xl font-bold text-emerald-400">${studFee.toLocaleString()}</span>
          </div>
          <p className="text-xs text-[rgb(148,163,184)] mt-2">
            This amount will be deducted from your account balance immediately.
          </p>
        </div>

        {/* Important Warnings */}
        <div className="rounded-lg border border-amber-500/30 bg-[rgba(212,168,67,0.1)] p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="text-sm font-semibold text-[rgb(220,235,255)] mb-1">
                Important Information
              </h5>
              <ul className="space-y-2 text-sm text-amber-400">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>30-Day Breeding Cooldown:</strong> Both parents will be unavailable for
                    breeding for 30 days after confirmation.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-amber-400 flex-shrink-0">•</span>
                  <span>
                    <strong>Gestation Period:</strong> The foal will be born immediately and enter
                    the critical 30-day development phase.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-amber-400 flex-shrink-0">•</span>
                  <span>
                    <strong>Foal Care Required:</strong> Daily enrichment activities and milestone
                    evaluations will be needed during the foal's development.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Confirmation Message */}
        <div className="text-center py-2">
          <p className="text-sm text-[rgb(220,235,255)]">
            Are you sure you want to breed <strong>{sire.name}</strong> and{' '}
            <strong>{dam.name}</strong>?
          </p>
        </div>
      </div>
    </BaseModal>
  );
};

export default BreedingConfirmationModal;
