/**
 * useGroomManagement Hook
 * React hook for managing groom assignments and interactions
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Custom hook for groom management functionality
 * @param {string} playerId - ID of the player
 * @returns {Object} Groom management state and functions
 */
export function useGroomManagement(playerId) {
  // State management
  const [groomState, setGroomState] = useState({
    grooms: [],
    assignments: {},
    interactions: {},
    isLoading: false,
    error: null,
  });

  const [definitions, setDefinitions] = useState({
    specialties: {},
    skillLevels: {},
    personalities: {},
    defaultGrooms: [],
  });

  /**
   * Fetch all grooms for the player
   */
  const fetchPlayerGrooms = useCallback(async () => {
    if (!playerId) return;

    try {
      setGroomState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`${API_BASE_URL}/grooms/player/${playerId}`);
      const data = await response.json();

      if (data.success) {
        setGroomState((prev) => ({
          ...prev,
          grooms: data.data.grooms || [],
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch grooms');
      }
    } catch (error) {
      console.error('Error fetching player grooms:', error);
      setGroomState((prev) => ({
        ...prev,
        error: error.message || 'Failed to fetch grooms',
      }));
    } finally {
      setGroomState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [playerId]);

  /**
   * Fetch assignments for a specific foal
   */
  const fetchFoalAssignments = useCallback(async (foalId) => {
    if (!foalId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/grooms/assignments/${foalId}`
      );
      const data = await response.json();

      if (data.success) {
        setGroomState((prev) => ({
          ...prev,
          assignments: {
            ...prev.assignments,
            [foalId]: data.data.assignments || [],
          },
        }));
        return data.data.assignments;
      } else {
        throw new Error(data.message || 'Failed to fetch assignments');
      }
    } catch (error) {
      console.error('Error fetching foal assignments:', error);
      setGroomState((prev) => ({
        ...prev,
        error: error.message || 'Failed to fetch assignments',
      }));
      return [];
    }
  }, []);

  /**
   * Assign a groom to a foal
   */
  const assignGroom = useCallback(
    async (foalId, groomId, options = {}) => {
      try {
        setGroomState((prev) => ({ ...prev, error: null }));

        const response = await fetch(`${API_BASE_URL}/grooms/assign`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            foalId,
            groomId,
            priority: options.priority || 1,
            notes: options.notes || null,
          }),
        });

        const data = await response.json();

        if (data.success) {
          // Refresh assignments for this foal
          await fetchFoalAssignments(foalId);
          return data.data;
        } else {
          throw new Error(data.message || 'Failed to assign groom');
        }
      } catch (error) {
        console.error('Error assigning groom:', error);
        setGroomState((prev) => ({
          ...prev,
          error: error.message || 'Failed to assign groom',
        }));
        throw error;
      }
    },
    [fetchFoalAssignments]
  );

  /**
   * Ensure default groom assignment for a foal
   */
  const ensureDefaultAssignment = useCallback(
    async (foalId) => {
      try {
        setGroomState((prev) => ({ ...prev, error: null }));

        const response = await fetch(
          `${API_BASE_URL}/grooms/ensure-default/${foalId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await response.json();

        if (data.success) {
          // Refresh assignments for this foal
          await fetchFoalAssignments(foalId);
          return data.data;
        } else {
          throw new Error(
            data.message || 'Failed to ensure default assignment'
          );
        }
      } catch (error) {
        console.error('Error ensuring default assignment:', error);
        setGroomState((prev) => ({
          ...prev,
          error: error.message || 'Failed to ensure default assignment',
        }));
        throw error;
      }
    },
    [fetchFoalAssignments]
  );

  /**
   * Record a groom interaction
   */
  const recordInteraction = useCallback(async (interactionData) => {
    try {
      setGroomState((prev) => ({ ...prev, error: null }));

      const response = await fetch(`${API_BASE_URL}/grooms/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(interactionData),
      });

      const data = await response.json();

      if (data.success) {
        // Update interactions cache
        const foalId = interactionData.foalId;
        setGroomState((prev) => ({
          ...prev,
          interactions: {
            ...prev.interactions,
            [foalId]: [
              ...(prev.interactions[foalId] || []),
              data.data.interaction,
            ],
          },
        }));
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to record interaction');
      }
    } catch (error) {
      console.error('Error recording interaction:', error);
      setGroomState((prev) => ({
        ...prev,
        error: error.message || 'Failed to record interaction',
      }));
      throw error;
    }
  }, []);

  /**
   * Hire a new groom
   */
  const hireGroom = useCallback(
    async (groomData) => {
      try {
        setGroomState((prev) => ({ ...prev, error: null }));

        const response = await fetch(`${API_BASE_URL}/grooms/hire`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(groomData),
        });

        const data = await response.json();

        if (data.success) {
          // Refresh grooms list
          await fetchPlayerGrooms();
          return data.data;
        } else {
          throw new Error(data.message || 'Failed to hire groom');
        }
      } catch (error) {
        console.error('Error hiring groom:', error);
        setGroomState((prev) => ({
          ...prev,
          error: error.message || 'Failed to hire groom',
        }));
        throw error;
      }
    },
    [fetchPlayerGrooms]
  );

  /**
   * Fetch groom system definitions
   */
  const fetchDefinitions = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/grooms/definitions`);
      const data = await response.json();

      if (data.success) {
        setDefinitions(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch definitions');
      }
    } catch (error) {
      console.error('Error fetching definitions:', error);
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setGroomState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Get active assignment for a foal
   */
  const getActiveAssignment = useCallback(
    (foalId) => {
      const assignments = groomState.assignments[foalId] || [];
      return assignments.find(
        (assignment) => assignment.isActive && assignment.priority === 1
      );
    },
    [groomState.assignments]
  );

  /**
   * Get groom by ID
   */
  const getGroomById = useCallback(
    (groomId) => {
      return groomState.grooms.find((groom) => groom.id === groomId);
    },
    [groomState.grooms]
  );

  // Load initial data
  useEffect(() => {
    if (playerId) {
      fetchPlayerGrooms();
    }
    fetchDefinitions();
  }, [playerId, fetchPlayerGrooms, fetchDefinitions]);

  return {
    // State
    ...groomState,
    definitions,

    // Actions
    fetchPlayerGrooms,
    fetchFoalAssignments,
    assignGroom,
    ensureDefaultAssignment,
    recordInteraction,
    hireGroom,
    clearError,

    // Helpers
    getActiveAssignment,
    getGroomById,

    // Computed values
    activeGrooms: groomState.grooms.filter((groom) => groom.is_active),
    totalGrooms: groomState.grooms.length,
    hasGrooms: groomState.grooms.length > 0,
  };
}

/**
 * Hook for managing daily care automation
 * @param {Array} foalIds - Array of foal IDs
 * @returns {Object} Daily care automation state and functions
 */
export function useDailyCareAutomation(foalIds = []) {
  const [automationState, setAutomationState] = useState({
    isRunning: false,
    results: null,
    error: null,
    lastRun: null,
  });

  const runDailyCare = useCallback(
    async (options = {}) => {
      try {
        setAutomationState((prev) => ({
          ...prev,
          isRunning: true,
          error: null,
        }));

        // This would call a daily care automation endpoint
        // For now, we'll simulate the process
        const results = {
          processed: foalIds.length,
          interactions: foalIds.map((foalId) => ({
            foalId,
            routine: 'morning_care',
            bondingChange: Math.floor(Math.random() * 5) + 1,
            cost: Math.random() * 10 + 5,
          })),
          summary: {
            totalInteractions: foalIds.length,
            totalBondingGain: foalIds.length * 3,
            totalCost: foalIds.length * 7.5,
          },
        };

        setAutomationState((prev) => ({
          ...prev,
          results,
          lastRun: new Date().toISOString(),
        }));

        return results;
      } catch (error) {
        console.error('Error running daily care:', error);
        setAutomationState((prev) => ({
          ...prev,
          error: error.message || 'Failed to run daily care',
        }));
        throw error;
      } finally {
        setAutomationState((prev) => ({ ...prev, isRunning: false }));
      }
    },
    [foalIds]
  );

  return {
    ...automationState,
    runDailyCare,
  };
}

export default useGroomManagement;
