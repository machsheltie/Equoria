/**
 * Tests for useHorseFilters Hook
 *
 * Tests cover:
 * - Reading filters from URL params
 * - Updating filters (URL updates)
 * - Clearing all filters
 * - Convenience methods (setSearch, setAgeRange, etc.)
 * - Toggle methods for breeds and disciplines
 * - Default values and edge cases
 *
 * Story 3-6: Horse Search & Filter - Task 2
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from '../../test/utils';
import { useHorseFilters } from '../useHorseFilters';

// Wrapper component for React Router context
function createWrapper(initialUrl = '/') {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/" element={<div>{children}</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('useHorseFilters', () => {
  describe('Reading filters from URL', () => {
    it('should return default filters when URL has no params', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      expect(result.current.filters).toEqual({
        search: '',
        minAge: undefined,
        maxAge: undefined,
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      });
    });

    it('should read search param from URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?search=thunder'),
      });

      expect(result.current.filters.search).toBe('thunder');
    });

    it('should read age range params from URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?minAge=5&maxAge=10'),
      });

      expect(result.current.filters.minAge).toBe(5);
      expect(result.current.filters.maxAge).toBe(10);
    });

    it('should read breed IDs from URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?breeds=1,2,3'),
      });

      expect(result.current.filters.breedIds).toEqual(['1', '2', '3']);
    });

    it('should read disciplines from URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?disciplines=Racing,Dressage'),
      });

      expect(result.current.filters.disciplines).toEqual(['Racing', 'Dressage']);
    });

    it('should read training status from URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?status=trained'),
      });

      expect(result.current.filters.trainingStatus).toBe('trained');
    });

    it('should read all params from URL', () => {
      const url = '/?search=test&minAge=5&maxAge=10&breeds=1,2&disciplines=Racing&status=trained';
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper(url),
      });

      expect(result.current.filters).toEqual({
        search: 'test',
        minAge: 5,
        maxAge: 10,
        breedIds: ['1', '2'],
        disciplines: ['Racing'],
        trainingStatus: 'trained',
      });
    });

    it('should handle invalid age params', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?minAge=invalid&maxAge=abc'),
      });

      expect(result.current.filters.minAge).toBeUndefined();
      expect(result.current.filters.maxAge).toBeUndefined();
    });

    it('should handle invalid training status', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?status=invalid'),
      });

      expect(result.current.filters.trainingStatus).toBe('all');
    });

    it('should handle empty array params', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?breeds=&disciplines='),
      });

      expect(result.current.filters.breedIds).toEqual([]);
      expect(result.current.filters.disciplines).toEqual([]);
    });
  });

  describe('setFilters', () => {
    it('should update search and reflect in URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.setFilters({ search: 'thunder' });
      });

      expect(result.current.filters.search).toBe('thunder');
    });

    it('should update age range and reflect in URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.setFilters({ minAge: 5, maxAge: 10 });
      });

      expect(result.current.filters.minAge).toBe(5);
      expect(result.current.filters.maxAge).toBe(10);
    });

    it('should update breed IDs and reflect in URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.setFilters({ breedIds: ['1', '2'] });
      });

      expect(result.current.filters.breedIds).toEqual(['1', '2']);
    });

    it('should update disciplines and reflect in URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.setFilters({ disciplines: ['Racing', 'Dressage'] });
      });

      expect(result.current.filters.disciplines).toEqual(['Racing', 'Dressage']);
    });

    it('should update training status and reflect in URL', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.setFilters({ trainingStatus: 'trained' });
      });

      expect(result.current.filters.trainingStatus).toBe('trained');
    });

    it('should merge new filters with existing ones', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?search=initial'),
      });

      act(() => {
        result.current.setFilters({ minAge: 5 });
      });

      expect(result.current.filters.search).toBe('initial');
      expect(result.current.filters.minAge).toBe(5);
    });

    it('should remove param when set to empty string', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?search=test'),
      });

      act(() => {
        result.current.setFilters({ search: '' });
      });

      expect(result.current.filters.search).toBe('');
    });

    it('should remove param when set to undefined', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?minAge=5'),
      });

      act(() => {
        result.current.setFilters({ minAge: undefined });
      });

      expect(result.current.filters.minAge).toBeUndefined();
    });

    it('should remove param when set to empty array', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?breeds=1,2'),
      });

      act(() => {
        result.current.setFilters({ breedIds: [] });
      });

      expect(result.current.filters.breedIds).toEqual([]);
    });
  });

  describe('clearFilters', () => {
    it('should clear all filters', () => {
      const url = '/?search=test&minAge=5&breeds=1&disciplines=Racing&status=trained';
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper(url),
      });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({
        search: '',
        minAge: undefined,
        maxAge: undefined,
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      });
    });

    it('should work when no filters are set', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({
        search: '',
        minAge: undefined,
        maxAge: undefined,
        breedIds: [],
        disciplines: [],
        trainingStatus: 'all',
      });
    });
  });

  describe('setSearch convenience method', () => {
    it('should update search only', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?minAge=5'),
      });

      act(() => {
        result.current.setSearch('thunder');
      });

      expect(result.current.filters.search).toBe('thunder');
      expect(result.current.filters.minAge).toBe(5); // Should preserve other filters
    });
  });

  describe('setAgeRange convenience method', () => {
    it('should update age range only', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?search=test'),
      });

      act(() => {
        result.current.setAgeRange(5, 10);
      });

      expect(result.current.filters.minAge).toBe(5);
      expect(result.current.filters.maxAge).toBe(10);
      expect(result.current.filters.search).toBe('test'); // Should preserve other filters
    });
  });

  describe('toggleBreed', () => {
    it('should add breed when not present', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.toggleBreed('1');
      });

      expect(result.current.filters.breedIds).toEqual(['1']);
    });

    it('should remove breed when present', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?breeds=1,2'),
      });

      act(() => {
        result.current.toggleBreed('1');
      });

      expect(result.current.filters.breedIds).toEqual(['2']);
    });

    it('should handle multiple toggles', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.toggleBreed('1');
      });

      act(() => {
        result.current.toggleBreed('2');
      });

      act(() => {
        result.current.toggleBreed('1'); // Remove 1
      });

      expect(result.current.filters.breedIds).toEqual(['2']);
    });
  });

  describe('toggleDiscipline', () => {
    it('should add discipline when not present', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/'),
      });

      act(() => {
        result.current.toggleDiscipline('Racing');
      });

      expect(result.current.filters.disciplines).toEqual(['Racing']);
    });

    it('should remove discipline when present', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?disciplines=Racing,Dressage'),
      });

      act(() => {
        result.current.toggleDiscipline('Racing');
      });

      expect(result.current.filters.disciplines).toEqual(['Dressage']);
    });
  });

  describe('setTrainingStatus convenience method', () => {
    it('should update training status only', () => {
      const { result } = renderHook(() => useHorseFilters(), {
        wrapper: createWrapper('/?search=test'),
      });

      act(() => {
        result.current.setTrainingStatus('trained');
      });

      expect(result.current.filters.trainingStatus).toBe('trained');
      expect(result.current.filters.search).toBe('test'); // Should preserve other filters
    });
  });
});
