/**
 * TrainerDiscoveryPanel — Hidden trait reveal system (Epic 13 — Story 13-3)
 *
 * Shows the 3-category discovery profile for a trainer:
 * - Discipline Specialization (2 slots) — which disciplines they secretly excel at
 * - Training Method (2 slots)           — how they structure sessions
 * - Horse Compatibility (2 slots)       — which horse temperaments they click with
 *
 * Discovered traits show as labelled badges. Undiscovered show as "?" placeholders.
 * Alert appears when a new trait is first discovered.
 *
 * Mirrors RiderDiscoveryPanel.tsx for the Trainer System.
 * Discovery is triggered by training sessions (replace MOCK data with /api/trainers/:id/discovery).
 */

import React from 'react';

// Discovery categories
export type TrainerDiscoveryCategory =
  | 'discipline_specialization'
  | 'training_method'
  | 'horse_compatibility';

export interface TrainerDiscoveredTrait {
  id: string;
  label: string;
  description: string;
  icon: string;
  strength: 'strong' | 'moderate' | 'mild';
}

export interface TrainerDiscoverySlot {
  slotIndex: number;
  category: TrainerDiscoveryCategory;
  discovered: boolean;
  trait?: TrainerDiscoveredTrait;
}

export interface TrainerDiscoveryProfile {
  trainerId: number;
  slots: TrainerDiscoverySlot[];
  discoveredCount: number;
  totalSlots: number;
  nextDiscoveryAt?: number; // sessions remaining until next reveal
}

// Category metadata
const CATEGORY_META: Record<TrainerDiscoveryCategory, { label: string; icon: string }> = {
  discipline_specialization: { label: 'Discipline Specialization', icon: '🏆' },
  training_method: { label: 'Training Method', icon: '📋' },
  horse_compatibility: { label: 'Horse Compatibility', icon: '🐴' },
};

// Strength metadata
const STRENGTH_META = {
  strong: { label: 'Strong', icon: '⬆⬆', colorClass: 'text-emerald-400' },
  moderate: { label: 'Moderate', icon: '⬆', colorClass: 'text-amber-400' },
  mild: { label: 'Mild', icon: '→', colorClass: 'text-white/50' },
};

// Helper: build an empty discovery profile (all undiscovered)
export function buildEmptyTrainerDiscoveryProfile(trainerId: number): TrainerDiscoveryProfile {
  const categories: TrainerDiscoveryCategory[] = [
    'discipline_specialization',
    'training_method',
    'horse_compatibility',
  ];
  const slots: TrainerDiscoverySlot[] = categories.flatMap((category, ci) => [
    { slotIndex: ci * 2, category, discovered: false },
    { slotIndex: ci * 2 + 1, category, discovered: false },
  ]);
  return {
    trainerId,
    slots,
    discoveredCount: 0,
    totalSlots: 6,
    nextDiscoveryAt: 5,
  };
}

const DiscoverySlotBadge: React.FC<{ slot: TrainerDiscoverySlot }> = ({ slot }) => {
  if (!slot.discovered || !slot.trait) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 border-dashed">
        <span className="text-white/20 text-lg">?</span>
        <span className="text-xs text-white/30 italic">Not yet discovered</span>
      </div>
    );
  }

  const { trait } = slot;
  const strengthMeta = STRENGTH_META[trait.strength];

  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/10 border border-white/20"
      data-testid={`discovery-trait-${trait.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-base">{trait.icon}</span>
        <div>
          <p className="text-sm text-white/90 font-medium">{trait.label}</p>
          <p className="text-[10px] text-white/40">{trait.description}</p>
        </div>
      </div>
      <span className={`text-xs font-bold ${strengthMeta.colorClass}`} title={strengthMeta.label}>
        {strengthMeta.icon}
      </span>
    </div>
  );
};

interface TrainerDiscoveryPanelProps {
  profile: TrainerDiscoveryProfile;
  newlyDiscovered?: string; // trait id just revealed — shows alert
}

const TrainerDiscoveryPanel: React.FC<TrainerDiscoveryPanelProps> = ({
  profile,
  newlyDiscovered,
}) => {
  const categories: TrainerDiscoveryCategory[] = [
    'discipline_specialization',
    'training_method',
    'horse_compatibility',
  ];

  const getSlotsForCategory = (category: TrainerDiscoveryCategory): TrainerDiscoverySlot[] =>
    profile.slots.filter((s) => s.category === category);

  const discoveryPercent =
    profile.totalSlots > 0 ? Math.round((profile.discoveredCount / profile.totalSlots) * 100) : 0;

  return (
    <div className="space-y-4" data-testid="trainer-discovery-panel">
      {/* Discovery Progress Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white/80">Trait Discovery</h3>
        <span className="text-xs text-white/40">
          {profile.discoveredCount} / {profile.totalSlots} revealed
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-celestial-gold/70 rounded-full transition-all duration-700"
          style={{ width: `${discoveryPercent}%` }}
        />
      </div>

      {/* New discovery alert */}
      {newlyDiscovered && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-sm text-celestial-gold animate-pulse"
          data-testid="new-discovery-alert"
        >
          <span>🔍</span>
          <span>New trait discovered!</span>
        </div>
      )}

      {/* Next discovery hint */}
      {profile.discoveredCount < profile.totalSlots && profile.nextDiscoveryAt && (
        <p className="text-xs text-white/30 italic">
          ~{profile.nextDiscoveryAt} more training session
          {profile.nextDiscoveryAt !== 1 ? 's' : ''} to reveal the next trait
        </p>
      )}

      {/* Category Sections */}
      {categories.map((category) => {
        const meta = CATEGORY_META[category];
        const slots = getSlotsForCategory(category);

        return (
          <div key={category}>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">{meta.icon}</span>
              <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">
                {meta.label}
              </h4>
            </div>
            <div className="space-y-2">
              {slots.map((slot) => (
                <DiscoverySlotBadge key={slot.slotIndex} slot={slot} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TrainerDiscoveryPanel;
