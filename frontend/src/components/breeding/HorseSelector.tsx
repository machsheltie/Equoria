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
import { Search, AlertCircle, Clock, Heart } from 'lucide-react';
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
    return 'text-emerald-400 bg-[rgba(16,185,129,0.1)] border-emerald-500/30';
  }

  if (reason?.includes('Cooldown')) {
    return 'text-amber-400 bg-[rgba(212,168,67,0.1)] border-amber-500/30';
  }

  return 'text-red-400 bg-[rgba(239,68,68,0.1)] border-red-500/30';
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
    <div className="rounded-lg border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-[rgb(220,235,255)]">{title}</h3>
        <p className="text-xs text-[rgb(148,163,184)] mt-1">
          {filter === 'male' ? 'Select a stallion (3+ years)' : 'Select a mare (3+ years)'}
        </p>
      </div>

      {/* Search Box */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(148,163,184)]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or breed..."
          className="celestial-input w-full pl-9"
          aria-label={`Search ${filter === 'male' ? 'stallions' : 'mares'}`}
        />
      </div>

      {/* Horse List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedHorses.length === 0 ? (
          <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4 text-center">
            <p className="text-sm text-[rgb(148,163,184)]">
              No {filter === 'male' ? 'stallions' : 'mares'} found
            </p>
          </div>
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
                    ? 'border-emerald-500 bg-[rgba(16,185,129,0.1)] ring-2 ring-emerald-500'
                    : canBreed
                      ? 'border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.4)] hover:border-emerald-500/30 hover:bg-[rgba(16,185,129,0.08)]'
                      : 'border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] opacity-60 cursor-not-allowed'
                }`}
                aria-label={`Select ${horse.name}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Horse Name */}
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[rgb(220,235,255)]">{horse.name}</p>
                      {isSelected && (
                        <span className="text-emerald-400 text-xs font-semibold">✓ Selected</span>
                      )}
                    </div>

                    {/* Breed & Age */}
                    <p className="text-xs text-[rgb(148,163,184)] mt-1">
                      {horse.breedName || 'Unknown Breed'} • {horse.age} years old
                    </p>

                    {/* Health & Status */}
                    <div className="flex items-center gap-2 mt-2">
                      {/* Health Status */}
                      {horse.healthStatus && (
                        <div className="flex items-center gap-1 text-xs text-[rgb(148,163,184)]">
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
                      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <span className="text-white text-sm">✓</span>
                      </div>
                    ) : canBreed ? (
                      <div className="h-6 w-6 rounded-full border-2 border-[rgba(37,99,235,0.3)]" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-[rgba(15,35,70,0.5)]" />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-[rgba(37,99,235,0.2)]">
        <p className="text-xs text-[rgb(148,163,184)]">
          {sortedHorses.filter((h) => canHorseBreed(h).canBreed).length} of {sortedHorses.length}{' '}
          available
        </p>
      </div>
    </div>
  );
};

export default HorseSelector;
