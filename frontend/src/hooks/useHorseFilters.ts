/**
 * useHorseFilters Hook
 *
 * Manages horse filter state with URL persistence using React Router's useSearchParams.
 * All filter state is stored in URL query parameters for:
 * - Bookmarking filtered views
 * - Sharing filtered URLs
 * - Browser back/forward navigation
 * - State persistence across page reloads
 *
 * Story 3-6: Horse Search & Filter - Task 2
 */

import { useSearchParams } from 'react-router-dom';
import { useMemo, useCallback } from 'react';

export interface HorseFilters {
  search: string;
  minAge?: number;
  maxAge?: number;
  breedIds: string[];
  disciplines: string[];
  trainingStatus: 'all' | 'trained' | 'untrained' | 'in_training';
}

/**
 * Parse integer from string, return undefined if invalid
 */
function parseIntOrUndefined(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse comma-separated string to array, return empty array if invalid
 */
function parseArrayParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter((v) => v.trim() !== '');
}

/**
 * Validate training status value
 */
function parseTrainingStatus(
  value: string | null
): 'all' | 'trained' | 'untrained' | 'in_training' {
  const validStatuses = ['all', 'trained', 'untrained', 'in_training'];
  if (value && validStatuses.includes(value)) {
    return value as 'all' | 'trained' | 'untrained' | 'in_training';
  }
  return 'all';
}

/**
 * Custom hook for managing horse filters with URL persistence
 */
export function useHorseFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL search params
  const filters: HorseFilters = useMemo(() => {
    return {
      search: searchParams.get('search') || '',
      minAge: parseIntOrUndefined(searchParams.get('minAge')),
      maxAge: parseIntOrUndefined(searchParams.get('maxAge')),
      breedIds: parseArrayParam(searchParams.get('breeds')),
      disciplines: parseArrayParam(searchParams.get('disciplines')),
      trainingStatus: parseTrainingStatus(searchParams.get('status')),
    };
  }, [searchParams]);

  /**
   * Update filters and sync to URL
   * Merges new filters with existing ones
   */
  const setFilters = useCallback(
    (newFilters: Partial<HorseFilters>) => {
      const params = new URLSearchParams(searchParams);

      // Update search
      if (newFilters.search !== undefined) {
        if (newFilters.search === '') {
          params.delete('search');
        } else {
          params.set('search', newFilters.search);
        }
      }

      // Update minAge
      if ('minAge' in newFilters) {
        if (newFilters.minAge === undefined) {
          params.delete('minAge');
        } else {
          params.set('minAge', String(newFilters.minAge));
        }
      }

      // Update maxAge
      if ('maxAge' in newFilters) {
        if (newFilters.maxAge === undefined) {
          params.delete('maxAge');
        } else {
          params.set('maxAge', String(newFilters.maxAge));
        }
      }

      // Update breedIds
      if (newFilters.breedIds !== undefined) {
        if (newFilters.breedIds.length === 0) {
          params.delete('breeds');
        } else {
          params.set('breeds', newFilters.breedIds.join(','));
        }
      }

      // Update disciplines
      if (newFilters.disciplines !== undefined) {
        if (newFilters.disciplines.length === 0) {
          params.delete('disciplines');
        } else {
          params.set('disciplines', newFilters.disciplines.join(','));
        }
      }

      // Update training status
      if (newFilters.trainingStatus !== undefined) {
        if (newFilters.trainingStatus === 'all') {
          params.delete('status');
        } else {
          params.set('status', newFilters.trainingStatus);
        }
      }

      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  /**
   * Clear all filters and reset URL
   */
  const clearFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  /**
   * Set search term only (convenience method)
   */
  const setSearch = useCallback(
    (search: string) => {
      setFilters({ search });
    },
    [setFilters]
  );

  /**
   * Set age range (convenience method)
   */
  const setAgeRange = useCallback(
    (minAge?: number, maxAge?: number) => {
      setFilters({ minAge, maxAge });
    },
    [setFilters]
  );

  /**
   * Toggle breed in filter
   */
  const toggleBreed = useCallback(
    (breedId: string) => {
      const currentBreeds = filters.breedIds;
      const newBreeds = currentBreeds.includes(breedId)
        ? currentBreeds.filter((id) => id !== breedId)
        : [...currentBreeds, breedId];
      setFilters({ breedIds: newBreeds });
    },
    [filters.breedIds, setFilters]
  );

  /**
   * Toggle discipline in filter
   */
  const toggleDiscipline = useCallback(
    (discipline: string) => {
      const currentDisciplines = filters.disciplines;
      const newDisciplines = currentDisciplines.includes(discipline)
        ? currentDisciplines.filter((d) => d !== discipline)
        : [...currentDisciplines, discipline];
      setFilters({ disciplines: newDisciplines });
    },
    [filters.disciplines, setFilters]
  );

  /**
   * Set training status (convenience method)
   */
  const setTrainingStatus = useCallback(
    (status: 'all' | 'trained' | 'untrained' | 'in_training') => {
      setFilters({ trainingStatus: status });
    },
    [setFilters]
  );

  return {
    filters,
    setFilters,
    clearFilters,
    setSearch,
    setAgeRange,
    toggleBreed,
    toggleDiscipline,
    setTrainingStatus,
  };
}
