/**
 * useTraitDiscovery Hook
 * React hook for managing trait discovery functionality
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

/**
 * Custom hook for trait discovery functionality
 * @param {number} horseId - ID of the horse
 * @param {Object} options - Hook options
 * @returns {Object} Discovery state and functions
 */
export function useTraitDiscovery(horseId, options = {}) {
  const {
    autoCheck = false,
    checkInterval = 30000, // 30 seconds
    enableRealTime = true,
  } = options;

  // State management
  const [discoveryState, setDiscoveryState] = useState({
    isLoading: false,
    isDiscovering: false,
    lastDiscovery: null,
    discoveredTraits: [],
    discoveryHistory: [],
    error: null,
  });

  const [discoveryStatus, setDiscoveryStatus] = useState({
    canDiscover: false,
    hiddenTraitCount: 0,
    metConditions: [],
    currentStats: null,
  });

  /**
   * Fetch current discovery status for the horse
   */
  const fetchDiscoveryStatus = useCallback(async () => {
    if (!horseId) return;

    try {
      setDiscoveryState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(
        `${API_BASE_URL}/traits/discovery-status/${horseId}`
      );
      const data = await response.json();

      if (data.success) {
        setDiscoveryStatus({
          canDiscover: data.data.canDiscover,
          hiddenTraitCount: data.data.traitCounts.hidden,
          metConditions: data.data.discoveryConditions.met || [],
          enrichmentConditions: data.data.discoveryConditions.enrichment || [],
          currentStats: data.data.currentStats,
        });
      } else {
        throw new Error(data.message || 'Failed to fetch discovery status');
      }
    } catch (error) {
      console.error('Error fetching discovery status:', error);
      setDiscoveryState((prev) => ({
        ...prev,
        error: error.message || 'Failed to fetch discovery status',
      }));
    } finally {
      setDiscoveryState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [horseId]);

  /**
   * Trigger trait discovery for the horse
   */
  const discoverTraits = useCallback(
    async (options = {}) => {
      if (!horseId) return null;

      try {
        setDiscoveryState((prev) => ({
          ...prev,
          isDiscovering: true,
          error: null,
        }));

        const response = await fetch(
          `${API_BASE_URL}/traits/discover/${horseId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              checkEnrichment: options.checkEnrichment !== false,
              forceCheck: options.forceCheck || false,
            }),
          }
        );

        const data = await response.json();

        if (data.success) {
          const discoveryResult = {
            timestamp: new Date().toISOString(),
            revealed: data.data.revealed || [],
            conditions: data.data.conditions || [],
            message: data.message,
          };

          setDiscoveryState((prev) => ({
            ...prev,
            lastDiscovery: discoveryResult,
            discoveredTraits: [
              ...prev.discoveredTraits,
              ...discoveryResult.revealed,
            ],
            discoveryHistory: [
              discoveryResult,
              ...prev.discoveryHistory.slice(0, 9),
            ], // Keep last 10
          }));

          // Refresh discovery status
          await fetchDiscoveryStatus();

          return discoveryResult;
        } else {
          throw new Error(data.message || 'Discovery failed');
        }
      } catch (error) {
        console.error('Error discovering traits:', error);
        setDiscoveryState((prev) => ({
          ...prev,
          error: error.message || 'Discovery failed',
        }));
        return null;
      } finally {
        setDiscoveryState((prev) => ({ ...prev, isDiscovering: false }));
      }
    },
    [horseId, fetchDiscoveryStatus]
  );

  /**
   * Get all traits for the horse
   */
  const fetchHorseTraits = useCallback(async () => {
    if (!horseId) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/traits/horse/${horseId}`);
      const data = await response.json();

      if (data.success) {
        return data.data.traits;
      } else {
        throw new Error(data.message || 'Failed to fetch traits');
      }
    } catch (error) {
      console.error('Error fetching horse traits:', error);
      setDiscoveryState((prev) => ({
        ...prev,
        error: error.message || 'Failed to fetch traits',
      }));
      return null;
    }
  }, [horseId]);

  /**
   * Clear discovery error
   */
  const clearError = useCallback(() => {
    setDiscoveryState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Reset discovery state
   */
  const resetDiscovery = useCallback(() => {
    setDiscoveryState({
      isLoading: false,
      isDiscovering: false,
      lastDiscovery: null,
      discoveredTraits: [],
      discoveryHistory: [],
      error: null,
    });
    setDiscoveryStatus({
      canDiscover: false,
      hiddenTraitCount: 0,
      metConditions: [],
      currentStats: null,
    });
  }, []);

  // Auto-check discovery status
  useEffect(() => {
    if (horseId) {
      fetchDiscoveryStatus();
    }
  }, [horseId, fetchDiscoveryStatus]);

  // Auto-check interval
  useEffect(() => {
    if (!autoCheck || !horseId) return;

    const interval = setInterval(fetchDiscoveryStatus, checkInterval);
    return () => clearInterval(interval);
  }, [autoCheck, horseId, checkInterval, fetchDiscoveryStatus]);

  // Real-time updates (WebSocket/Socket.IO)
  useEffect(() => {
    if (!enableRealTime || !horseId) return;

    // Check if Socket.IO is available
    if (typeof window !== 'undefined' && window.io) {
      const socket = window.io();

      const handleTraitDiscovered = (data) => {
        if (data.horseId === horseId) {
          const discoveryResult = {
            timestamp: data.timestamp,
            revealed: data.revealed || [],
            conditions: data.conditions || [],
            message: data.message || 'Traits discovered!',
          };

          setDiscoveryState((prev) => ({
            ...prev,
            lastDiscovery: discoveryResult,
            discoveredTraits: [
              ...prev.discoveredTraits,
              ...discoveryResult.revealed,
            ],
            discoveryHistory: [
              discoveryResult,
              ...prev.discoveryHistory.slice(0, 9),
            ],
          }));

          // Refresh discovery status
          fetchDiscoveryStatus();
        }
      };

      socket.on('traitDiscovered', handleTraitDiscovered);

      return () => {
        socket.off('traitDiscovered', handleTraitDiscovered);
        socket.disconnect();
      };
    }
  }, [enableRealTime, horseId, fetchDiscoveryStatus]);

  return {
    // State
    ...discoveryState,
    discoveryStatus,

    // Actions
    discoverTraits,
    fetchDiscoveryStatus,
    fetchHorseTraits,
    clearError,
    resetDiscovery,

    // Computed values
    hasNewDiscoveries: discoveryState.discoveredTraits.length > 0,
    canDiscover: discoveryStatus.canDiscover && !discoveryState.isDiscovering,
    discoveryProgress: {
      total:
        discoveryStatus.hiddenTraitCount +
        discoveryState.discoveredTraits.length,
      discovered: discoveryState.discoveredTraits.length,
      remaining: discoveryStatus.hiddenTraitCount,
    },
  };
}

/**
 * Hook for batch trait discovery across multiple horses
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Object} Batch discovery state and functions
 */
export function useBatchTraitDiscovery(horseIds = []) {
  const [batchState, setBatchState] = useState({
    isProcessing: false,
    results: [],
    errors: [],
    progress: 0,
    error: null,
  });

  const batchDiscover = useCallback(
    async (options = {}) => {
      if (!horseIds.length) return;

      try {
        setBatchState((prev) => ({
          ...prev,
          isProcessing: true,
          error: null,
          progress: 0,
        }));

        const response = await fetch(`${API_BASE_URL}/traits/batch-discover`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            horseIds,
            checkEnrichment: options.checkEnrichment !== false,
          }),
        });

        const data = await response.json();

        if (data.success) {
          setBatchState((prev) => ({
            ...prev,
            results: data.data.results || [],
            errors: data.data.errors || [],
            progress: 100,
          }));
          return data.data;
        } else {
          throw new Error(data.message || 'Batch discovery failed');
        }
      } catch (error) {
        console.error('Error in batch discovery:', error);
        setBatchState((prev) => ({
          ...prev,
          error: error.message || 'Batch discovery failed',
        }));
        return null;
      } finally {
        setBatchState((prev) => ({ ...prev, isProcessing: false }));
      }
    },
    [horseIds]
  );

  const resetBatch = useCallback(() => {
    setBatchState({
      isProcessing: false,
      results: [],
      errors: [],
      progress: 0,
      error: null,
    });
  }, []);

  return {
    ...batchState,
    batchDiscover,
    resetBatch,
    totalRevealed: batchState.results.reduce(
      (sum, result) => sum + (result.revealed?.length || 0),
      0
    ),
  };
}

export default useTraitDiscovery;
