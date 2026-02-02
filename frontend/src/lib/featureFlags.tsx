/**
 * Feature Flag Hooks and Utilities
 *
 * Frontend feature flag management for React components.
 * Integrates with backend feature flag service via API.
 *
 * @module lib/featureFlags
 */

import React, { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Feature flag types
 */
export type FlagType = 'BOOLEAN' | 'PERCENTAGE' | 'STRING' | 'USER_LIST';

export interface FeatureFlag {
  name: string;
  value: boolean | string | number;
  type: FlagType;
  description?: string;
}

export interface FeatureFlagsResponse {
  flags: FeatureFlag[];
}

/**
 * Local feature flag definitions for client-only flags
 * These don't require backend calls
 */
export const LOCAL_FLAGS: Record<string, boolean | string> = {
  // UI-only flags that don't need backend verification
  FF_UI_ANIMATIONS: true,
  FF_UI_REDUCED_MOTION: false,
};

/**
 * Fetch feature flags from backend API
 */
async function fetchFeatureFlags(): Promise<Record<string, boolean | string>> {
  try {
    const response = await fetch('/api/internal/feature-flags', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch feature flags');
    }

    const data: FeatureFlagsResponse = await response.json();

    // Convert array to object for easier lookup
    return data.flags.reduce(
      (acc, flag) => {
        acc[flag.name] = flag.value as boolean | string;
        return acc;
      },
      {} as Record<string, boolean | string>
    );
  } catch {
    // Fall back to local defaults on error
    console.warn('[FeatureFlags] Failed to fetch, using local defaults');
    return LOCAL_FLAGS;
  }
}

/**
 * Hook to get all feature flags
 *
 * @returns Query result with all feature flags
 *
 * @example
 * const { data: flags, isLoading } = useFeatureFlags();
 * if (flags?.FF_NEW_FEATURE) {
 *   // Render new feature
 * }
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['featureFlags'],
    queryFn: fetchFeatureFlags,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    initialData: LOCAL_FLAGS,
  });
}

/**
 * Hook to check if a specific feature flag is enabled
 *
 * @param flagName - Name of the feature flag
 * @param defaultValue - Default value if flag not found
 * @returns Boolean indicating if flag is enabled
 *
 * @example
 * function Component() {
 *   const newUIEnabled = useFeatureFlag('FF_UI_NEW_DASHBOARD');
 *
 *   if (newUIEnabled) {
 *     return <NewDashboard />;
 *   }
 *   return <LegacyDashboard />;
 * }
 */
export function useFeatureFlag(flagName: string, defaultValue: boolean = false): boolean {
  const { data: flags } = useFeatureFlags();

  return useMemo(() => {
    if (!flags) return defaultValue;
    const value = flags[flagName];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return defaultValue;
  }, [flags, flagName, defaultValue]);
}

/**
 * Hook to get a feature flag's string value (for A/B variants)
 *
 * @param flagName - Name of the feature flag
 * @param defaultValue - Default variant
 * @returns String variant value
 *
 * @example
 * function LandingPage() {
 *   const variant = useFeatureVariant('FF_AB_LANDING_PAGE', 'control');
 *
 *   switch (variant) {
 *     case 'variant_a': return <LandingA />;
 *     case 'variant_b': return <LandingB />;
 *     default: return <LandingControl />;
 *   }
 * }
 */
export function useFeatureVariant(flagName: string, defaultValue: string = ''): string {
  const { data: flags } = useFeatureFlags();

  return useMemo(() => {
    if (!flags) return defaultValue;
    const value = flags[flagName];
    return typeof value === 'string' ? value : defaultValue;
  }, [flags, flagName, defaultValue]);
}

/**
 * Higher-order component to conditionally render based on feature flag
 *
 * @param flagName - Feature flag to check
 * @param Component - Component to render if enabled
 * @param FallbackComponent - Component to render if disabled (optional)
 * @returns Wrapped component
 *
 * @example
 * const ProtectedFeature = withFeatureFlag(
 *   'FF_NEW_FEATURE',
 *   NewFeatureComponent,
 *   LegacyFeatureComponent
 * );
 */
export function withFeatureFlag<P extends object>(
  flagName: string,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureFlaggedComponent(props: P) {
    const isEnabled = useFeatureFlag(flagName);

    if (isEnabled) {
      return <Component {...props} />;
    }

    if (FallbackComponent) {
      return <FallbackComponent {...props} />;
    }

    return null;
  };
}

/**
 * Utility to check flag status imperatively (outside React)
 * Uses cached value if available
 *
 * @param flagName - Feature flag name
 * @returns Promise<boolean>
 */
export async function checkFeatureFlag(flagName: string): Promise<boolean> {
  // Check local flags first
  if (flagName in LOCAL_FLAGS) {
    const value = LOCAL_FLAGS[flagName];
    return typeof value === 'boolean' ? value : false;
  }

  // Fetch from API
  try {
    const flags = await fetchFeatureFlags();
    const value = flags[flagName];
    return typeof value === 'boolean' ? value : false;
  } catch {
    return false;
  }
}

/**
 * Create a feature flag checker function with caching
 * Useful for non-React contexts
 *
 * @example
 * const isEnabled = createFlagChecker();
 *
 * if (await isEnabled('FF_NEW_FEATURE')) {
 *   // Do something
 * }
 */
export function createFlagChecker() {
  let cachedFlags: Record<string, boolean | string> | null = null;
  let lastFetch = 0;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  return async (flagName: string): Promise<boolean> => {
    const now = Date.now();

    // Refresh cache if expired
    if (!cachedFlags || now - lastFetch > CACHE_TTL) {
      cachedFlags = await fetchFeatureFlags();
      lastFetch = now;
    }

    const value = cachedFlags[flagName];
    return typeof value === 'boolean' ? value : false;
  };
}

/**
 * Hook for A/B test tracking
 * Automatically logs variant assignment
 *
 * @param testName - Name of the A/B test
 * @param variants - Possible variants
 */
export function useABTest(
  testName: string,
  variants: string[]
): { variant: string; trackConversion: () => void } {
  const variant = useFeatureVariant(testName, variants[0]);

  const trackConversion = useCallback(() => {
    // Track conversion event
    console.log('[ABTest] Conversion', { testName, variant });

    // In production, send to analytics
    // analytics.track('ab_conversion', { testName, variant });
  }, [testName, variant]);

  return { variant, trackConversion };
}
