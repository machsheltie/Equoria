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
  onSelect: (horse: Horse) => void;
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
      const daysRemaining = Math.ceil((cooldownDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
    return 'text-green-700 bg-green-50 border-green-200';
  }

  if (reason?.includes('Cooldown')) {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }

  return 'text-red-700 bg-red-50 border-red-200';
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
      filtered = filtered.filter((horse) =>
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
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">
          {filter === 'male' ? 'Select a stallion (3+ years)' : 'Select a mare (3+ years)'}
        </p>
      </div>

      {/* Search Box */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name or breed..."
          className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          aria-label={`Search ${filter === 'male' ? 'stallions' : 'mares'}`}
        />
      </div>

      {/* Horse List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sortedHorses.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-center">
            <p className="text-sm text-slate-600">
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
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500'
                    : canBreed
                    ? 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                    : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                }`}
                aria-label={`Select ${horse.name}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Horse Name */}
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{horse.name}</p>
                      {isSelected && (
                        <span className="text-emerald-600 text-xs font-semibold">✓ Selected</span>
                      )}
                    </div>

                    {/* Breed & Age */}
                    <p className="text-xs text-slate-600 mt-1">
                      {horse.breedName || 'Unknown Breed'} • {horse.age} years old
                    </p>

                    {/* Health & Status */}
                    <div className="flex items-center gap-2 mt-2">
                      {/* Health Status */}
                      {horse.healthStatus && (
                        <div className="flex items-center gap-1 text-xs">
                          <Heart className="h-3 w-3" />
                          <span className="capitalize">{horse.healthStatus}</span>
                        </div>
                      )}

                      {/* Breeding Status */}
                      {!canBreed && reason && (
                        <div className={`flex items-center gap-1 text-xs border rounded px-2 py-0.5 ${getStatusColor(canBreed, reason)}`}>
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
                      <div className="h-6 w-6 rounded-full border-2 border-slate-300" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-slate-200" />
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-slate-200">
        <p className="text-xs text-slate-600">
          {sortedHorses.filter((h) => canHorseBreed(h).canBreed).length} of {sortedHorses.length} available
        </p>
      </div>
    </div>
  );
};

export default HorseSelector;
