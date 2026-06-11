/**
 * HorseSelector Component
 *
 * Displays a filterable/searchable list of horses for breeding selection.
 * Shows horse age, health status, and breeding cooldown information.
 * Disables horses that cannot breed (age, cooldown, health).
 *
 * Story 6-1: Breeding Pair Selection - Subcomponent
 */

import React, { useState, useMemo } from 'react';
import { Search, AlertCircle, Clock, Heart, SearchX } from 'lucide-react';
import { Input } from '@/components/ui/form';
import EmptyState from '@/components/ui/EmptyState';
import type { Horse } from '@/types/breeding';

export interface HorseSelectorProps {
  horses: Horse[];
  selectedHorse: Horse | null;
  onSelect: (_horse: Horse) => void;
  filter: 'male' | 'female';
  title: string;
}

/**
 * Check if horse can breed based on age, health, and cooldown
 */
function canHorseBreed(horse: Horse): { canBreed: boolean; reason?: string } {
  // Age requirement: 3+ years
  if (horse.age < 3) {
    return { canBreed: false, reason: `Too young (${horse.age}y, needs 3+y)` };
  }

  // Health check
  if (horse.healthStatus && horse.healthStatus.toLowerCase() === 'injured') {
    return { canBreed: false, reason: 'Injured' };
  }

  // Breeding cooldown check
  if (horse.breedingCooldownEndsAt) {
    const cooldownDate = new Date(horse.breedingCooldownEndsAt);
    const now = new Date();

    if (cooldownDate > now) {
      const daysRemaining = Math.ceil(
        (cooldownDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { canBreed: false, reason: `Cooldown (${daysRemaining}d remaining)` };
    }
  }

  return { canBreed: true };
}

/**
 * Get status badge color based on breeding availability
 */
function getStatusColor(canBreed: boolean, reason?: string): string {
  if (canBreed) {
    return 'text-[var(--role-success-text)] bg-[var(--role-success-bg)] border-[var(--role-success-border)]';
  }

  if (reason?.includes('Cooldown')) {
    return 'text-[var(--role-warning-text)] bg-[var(--role-warning-bg)] border-[var(--role-warning-border)]';
  }

  return 'text-[var(--role-danger-text)] bg-[var(--role-danger-bg)] border-[var(--role-danger-border)]';
}

const HorseSelector: React.FC<HorseSelectorProps> = ({
  horses,
  selectedHorse,
  onSelect,
  filter,
  title,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter horses by sex and search term
  const filteredHorses = useMemo(() => {
    let filtered = horses.filter((horse) => {
      // Filter by sex
      if (filter === 'male' && horse.sex !== 'Male') return false;
      if (filter === 'female' && horse.sex !== 'Female') return false;
      return true;
    });

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (horse) =>
          horse.name.toLowerCase().includes(searchLower) ||
          horse.breedName?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [horses, filter, searchTerm]);

  // Sort: available horses first, then by name
  const sortedHorses = useMemo(() => {
    return [...filteredHorses].sort((a, b) => {
      const aStatus = canHorseBreed(a);
      const bStatus = canHorseBreed(b);

      // Available horses first
      if (aStatus.canBreed && !bStatus.canBreed) return -1;
      if (!aStatus.canBreed && bStatus.canBreed) return 1;

      // Then alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [filteredHorses]);

  return (
    <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--role-neutral-bg)] p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-role-secondary mt-1">
          {filter === 'male' ? 'Select a stallion (3+ years)' : 'Select a mare (3+ years)'}
        </p>
      </div>

      {/* Search Box */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-role-secondary" />
        {/* Canonical Input (D-13) — replaces the deprecated celestial-input recipe */}
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or breed..."
          className="pl-9"
          aria-label={`Search ${filter === 'male' ? 'stallions' : 'mares'}`}
        />
      </div>

      {/* Horse List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedHorses.length === 0 ? (
          /* Shared EmptyState (D-17) — replaces the local empty-list recipe */
          <EmptyState
            variant="filtered"
            icon={<SearchX className="w-8 h-8" />}
            title={`No ${filter === 'male' ? 'stallions' : 'mares'} found`}
            description="Try a different search or breed filter."
          />
        ) : (
          sortedHorses.map((horse) => {
            const { canBreed, reason } = canHorseBreed(horse);
            const isSelected = selectedHorse?.id === horse.id;

            return (
              <button
                key={horse.id}
                onClick={() => canBreed && onSelect(horse)}
                disabled={!canBreed}
                className={`w-full text-left rounded-md border p-3 transition-all ${
                  isSelected
                    ? 'border-[var(--status-success)] bg-[var(--role-success-bg)] ring-2 ring-[var(--status-success)]'
                    : canBreed
                      ? 'border-[var(--glass-border)] bg-[var(--role-neutral-bg)] hover:border-[var(--role-success-border)] hover:bg-[var(--role-success-bg)]'
                      : 'border-[var(--glass-border)] bg-[var(--role-neutral-bg)] opacity-60 cursor-not-allowed'
                }`}
                aria-label={`Select ${horse.name}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Horse Name */}
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[var(--text-primary)]">{horse.name}</p>
                      {isSelected && (
                        <span className="text-[var(--role-success-text)] text-xs font-semibold">
                          ✓ Selected
                        </span>
                      )}
                    </div>

                    {/* Breed & Age */}
                    <p className="text-xs text-role-secondary mt-1">
                      {horse.breedName || 'Unknown Breed'} • {horse.age} years old
                    </p>

                    {/* Health & Status */}
                    <div className="flex items-center gap-2 mt-2">
                      {/* Health Status */}
                      {horse.healthStatus && (
                        <div className="flex items-center gap-1 text-xs text-role-secondary">
                          <Heart className="h-3 w-3" />
                          <span className="capitalize">{horse.healthStatus}</span>
                        </div>
                      )}

                      {/* Breeding Status */}
                      {!canBreed && reason && (
                        <div
                          className={`flex items-center gap-1 text-xs border rounded px-2 py-0.5 ${getStatusColor(canBreed, reason)}`}
                        >
                          {reason.includes('Cooldown') ? (
                            <Clock className="h-3 w-3" />
                          ) : (
                            <AlertCircle className="h-3 w-3" />
                          )}
                          <span>{reason}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <div className="h-6 w-6 rounded-full bg-[var(--status-success)] flex items-center justify-center">
                        <span className="text-[var(--text-primary)] text-sm">✓</span>
                      </div>
                    ) : canBreed ? (
                      <div className="h-6 w-6 rounded-full border-2 border-[var(--glass-border)]" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-[var(--role-neutral-bg)]" />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-[var(--glass-border)]">
        <p className="text-xs text-role-secondary">
          {sortedHorses.filter((h) => canHorseBreed(h).canBreed).length} of {sortedHorses.length}{' '}
          available
        </p>
      </div>
    </div>
  );
};

export default HorseSelector;
