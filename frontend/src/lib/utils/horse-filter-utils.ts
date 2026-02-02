/**
 * Horse Filtering Utilities
 *
 * Provides client-side filtering functions for horse lists:
 * - Search by name, breed, traits
 * - Filter by age range
 * - Filter by breed
 * - Filter by discipline
 * - Filter by training status
 * - Combined filter application
 *
 * Story 3-6: Horse Search & Filter - Task 1
 */

export interface Horse {
  id: number;
  name: string;
  age: number;
  breedId?: number;
  breedName?: string;
  disciplines?: string[];
  traits?: Array<{ name: string }>;
  trainingCooldown?: Date | string | null;
  lastTrainedAt?: Date | string | null;
}

export interface HorseFilters {
  search: string;
  minAge?: number;
  maxAge?: number;
  breedIds: string[];
  disciplines: string[];
  trainingStatus: 'all' | 'trained' | 'untrained' | 'in_training';
}

/**
 * Filter horses by search term (name, breed, traits)
 * Case-insensitive search across multiple fields
 */
export function filterBySearch(horses: Horse[], searchTerm: string): Horse[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return horses;
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  return horses.filter((horse) => {
    // Search in name
    if (horse.name?.toLowerCase().includes(normalizedSearch)) {
      return true;
    }

    // Search in breed name
    if (horse.breedName?.toLowerCase().includes(normalizedSearch)) {
      return true;
    }

    // Search in traits
    if (horse.traits && Array.isArray(horse.traits)) {
      const hasMatchingTrait = horse.traits.some((trait) =>
        trait.name?.toLowerCase().includes(normalizedSearch)
      );
      if (hasMatchingTrait) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Filter horses by age range
 * Inclusive range (minAge <= age <= maxAge)
 */
export function filterByAgeRange(horses: Horse[], minAge?: number, maxAge?: number): Horse[] {
  if (minAge === undefined && maxAge === undefined) {
    return horses;
  }

  return horses.filter((horse) => {
    const age = horse.age;

    // Check min age
    if (minAge !== undefined && age < minAge) {
      return false;
    }

    // Check max age
    if (maxAge !== undefined && age > maxAge) {
      return false;
    }

    return true;
  });
}

/**
 * Filter horses by breed IDs
 * Returns horses matching any of the specified breed IDs
 */
export function filterByBreed(horses: Horse[], breedIds: string[]): Horse[] {
  if (!breedIds || breedIds.length === 0) {
    return horses;
  }

  // Convert to Set for O(1) lookup
  const breedIdSet = new Set(breedIds);

  return horses.filter((horse) => {
    if (!horse.breedId) {
      return false;
    }

    return breedIdSet.has(String(horse.breedId));
  });
}

/**
 * Filter horses by disciplines
 * Returns horses that participate in any of the specified disciplines
 */
export function filterByDiscipline(horses: Horse[], disciplines: string[]): Horse[] {
  if (!disciplines || disciplines.length === 0) {
    return horses;
  }

  // Normalize disciplines to lowercase for case-insensitive matching
  const normalizedDisciplines = disciplines.map((d) => d.toLowerCase());

  return horses.filter((horse) => {
    if (!horse.disciplines || !Array.isArray(horse.disciplines)) {
      return false;
    }

    // Check if horse has any of the specified disciplines
    return horse.disciplines.some((horseDiscipline) =>
      normalizedDisciplines.includes(horseDiscipline.toLowerCase())
    );
  });
}

/**
 * Filter horses by training status
 * - trained: Has been trained (lastTrainedAt exists)
 * - untrained: Never been trained (lastTrainedAt is null)
 * - in_training: Currently in training cooldown
 * - all: No filter
 */
export function filterByTrainingStatus(
  horses: Horse[],
  status: 'trained' | 'untrained' | 'in_training' | 'all'
): Horse[] {
  if (status === 'all') {
    return horses;
  }

  const now = new Date();

  return horses.filter((horse) => {
    const lastTrainedAt = horse.lastTrainedAt ? new Date(horse.lastTrainedAt) : null;
    const trainingCooldown = horse.trainingCooldown ? new Date(horse.trainingCooldown) : null;

    switch (status) {
      case 'trained':
        // Has been trained at some point
        return lastTrainedAt !== null;

      case 'untrained':
        // Never been trained
        return lastTrainedAt === null;

      case 'in_training':
        // Currently in training cooldown (cooldown date is in the future)
        return trainingCooldown !== null && trainingCooldown > now;

      default:
        return true;
    }
  });
}

/**
 * Apply all filters to a horse list
 * Filters are applied in sequence for optimal performance
 */
export function applyFilters(horses: Horse[], filters: HorseFilters): Horse[] {
  let filtered = horses;

  // Apply search filter (fastest to eliminate many results)
  if (filters.search) {
    filtered = filterBySearch(filtered, filters.search);
  }

  // Apply breed filter
  if (filters.breedIds && filters.breedIds.length > 0) {
    filtered = filterByBreed(filtered, filters.breedIds);
  }

  // Apply age range filter
  if (filters.minAge !== undefined || filters.maxAge !== undefined) {
    filtered = filterByAgeRange(filtered, filters.minAge, filters.maxAge);
  }

  // Apply discipline filter
  if (filters.disciplines && filters.disciplines.length > 0) {
    filtered = filterByDiscipline(filtered, filters.disciplines);
  }

  // Apply training status filter
  if (filters.trainingStatus && filters.trainingStatus !== 'all') {
    filtered = filterByTrainingStatus(filtered, filters.trainingStatus);
  }

  return filtered;
}

/**
 * Check if any filters are active (not default values)
 */
export function hasActiveFilters(filters: HorseFilters): boolean {
  return (
    filters.search !== '' ||
    filters.minAge !== undefined ||
    filters.maxAge !== undefined ||
    (filters.breedIds && filters.breedIds.length > 0) ||
    (filters.disciplines && filters.disciplines.length > 0) ||
    (filters.trainingStatus && filters.trainingStatus !== 'all')
  );
}

/**
 * Get count of active filters
 */
export function getActiveFilterCount(filters: HorseFilters): number {
  let count = 0;

  if (filters.search !== '') count++;
  if (filters.minAge !== undefined || filters.maxAge !== undefined) count++;
  if (filters.breedIds && filters.breedIds.length > 0) count++;
  if (filters.disciplines && filters.disciplines.length > 0) count++;
  if (filters.trainingStatus && filters.trainingStatus !== 'all') count++;

  return count;
}
