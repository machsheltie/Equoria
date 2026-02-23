/**
 * RiderDiscoveryPanel Component (Epic 9C — Story 9C-3)
 *
 * Shows the 3-category discovery profile for a rider:
 * - Discipline Affinities (2 slots)
 * - Temperament Compatibility (2 slots)
 * - Gait Affinity (2 slots)
 *
 * Discovered traits show as labelled badges. Undiscovered show as "?" placeholders.
 * Alert appears when a new trait is first discovered.
 */

import React from 'react';
import {
  RiderDiscoveryProfile,
  DISCOVERY_CATEGORY_META,
  DISCOVERY_STRENGTH_META,
  DiscoveryCategory,
  DiscoverySlot,
} from '@/types/riderDiscovery';

interface RiderDiscoveryPanelProps {
  profile: RiderDiscoveryProfile;
  newlyDiscovered?: string; // trait id just revealed — shows alert
}

const DiscoverySlotBadge: React.FC<{ slot: DiscoverySlot }> = ({ slot }) => {
  if (!slot.discovered || !slot.trait) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 border-dashed">
        <span className="text-white/20 text-lg">?</span>
        <span className="text-xs text-white/30 italic">Not yet discovered</span>
      </div>
    );
  }

  const { trait } = slot;
  const strengthMeta =
    DISCOVERY_STRENGTH_META[trait.strength as keyof typeof DISCOVERY_STRENGTH_META];

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
      <span
        className={`text-xs font-bold ${strengthMeta?.colorClass ?? 'text-white/50'}`}
        title={strengthMeta?.label}
      >
        {strengthMeta?.icon ?? '–'}
      </span>
    </div>
  );
};

const RiderDiscoveryPanel: React.FC<RiderDiscoveryPanelProps> = ({ profile, newlyDiscovered }) => {
  const categories: DiscoveryCategory[] = [
    'discipline_affinity',
    'temperament_compatibility',
    'gait_affinity',
  ];

  const getSlotsForCategory = (category: DiscoveryCategory): DiscoverySlot[] =>
    profile.slots.filter((s) => s.category === category);

  const discoveryPercent = Math.round((profile.discoveredCount / profile.totalSlots) * 100);

  return (
    <div className="space-y-4" data-testid="rider-discovery-panel">
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
          ~{profile.nextDiscoveryAt} more competition{profile.nextDiscoveryAt !== 1 ? 's' : ''} to
          reveal the next trait
        </p>
      )}

      {/* Category Sections */}
      {categories.map((category) => {
        const meta = DISCOVERY_CATEGORY_META[category];
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

export default RiderDiscoveryPanel;
