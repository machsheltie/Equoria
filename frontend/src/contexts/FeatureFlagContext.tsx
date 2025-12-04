/**
 * Feature Flag React Context
 *
 * Provides feature flag state to the React component tree.
 * Integrates with React Query for data fetching and caching.
 *
 * @module contexts/FeatureFlagContext
 */

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useFeatureFlags, LOCAL_FLAGS } from '../lib/featureFlags';

/**
 * Feature flags context value type
 */
interface FeatureFlagContextValue {
  /** Map of flag names to their values */
  flags: Record<string, boolean | string>;
  /** Check if a specific flag is enabled */
  isEnabled: (flagName: string, defaultValue?: boolean) => boolean;
  /** Get a flag's string value */
  getVariant: (flagName: string, defaultValue?: string) => string;
  /** Whether flags are still loading */
  isLoading: boolean;
  /** Whether there was an error loading flags */
  isError: boolean;
  /** Refresh flags from server */
  refetch: () => void;
}

/**
 * Feature Flag Context
 */
const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

/**
 * Provider props
 */
interface FeatureFlagProviderProps {
  children: ReactNode;
  /** Optional override flags for testing */
  overrides?: Record<string, boolean | string>;
}

/**
 * Feature Flag Provider Component
 *
 * Wraps the application to provide feature flag context to all components.
 *
 * @example
 * function App() {
 *   return (
 *     <QueryClientProvider client={queryClient}>
 *       <FeatureFlagProvider>
 *         <Router>
 *           <Routes />
 *         </Router>
 *       </FeatureFlagProvider>
 *     </QueryClientProvider>
 *   );
 * }
 */
export function FeatureFlagProvider({
  children,
  overrides,
}: FeatureFlagProviderProps) {
  const { data: flags = LOCAL_FLAGS, isLoading, isError, refetch } = useFeatureFlags();

  // Merge flags with overrides
  const mergedFlags = useMemo(() => {
    return { ...flags, ...overrides };
  }, [flags, overrides]);

  // Check if flag is enabled
  const isEnabled = useMemo(() => {
    return (flagName: string, defaultValue: boolean = false): boolean => {
      const value = mergedFlags[flagName];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value.toLowerCase() === 'true';
      return defaultValue;
    };
  }, [mergedFlags]);

  // Get variant string
  const getVariant = useMemo(() => {
    return (flagName: string, defaultValue: string = ''): string => {
      const value = mergedFlags[flagName];
      return typeof value === 'string' ? value : defaultValue;
    };
  }, [mergedFlags]);

  const contextValue = useMemo<FeatureFlagContextValue>(
    () => ({
      flags: mergedFlags,
      isEnabled,
      getVariant,
      isLoading,
      isError,
      refetch,
    }),
    [mergedFlags, isEnabled, getVariant, isLoading, isError, refetch]
  );

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook to access feature flag context
 *
 * @returns Feature flag context value
 * @throws Error if used outside FeatureFlagProvider
 *
 * @example
 * function MyComponent() {
 *   const { isEnabled } = useFeatureFlagContext();
 *
 *   if (isEnabled('FF_NEW_FEATURE')) {
 *     return <NewFeature />;
 *   }
 *   return <LegacyFeature />;
 * }
 */
export function useFeatureFlagContext(): FeatureFlagContextValue {
  const context = useContext(FeatureFlagContext);

  if (!context) {
    throw new Error(
      'useFeatureFlagContext must be used within a FeatureFlagProvider'
    );
  }

  return context;
}

/**
 * Component that conditionally renders children based on a feature flag
 *
 * @example
 * <FeatureGate flag="FF_NEW_DASHBOARD">
 *   <NewDashboard />
 * </FeatureGate>
 *
 * @example
 * <FeatureGate flag="FF_NEW_DASHBOARD" fallback={<LegacyDashboard />}>
 *   <NewDashboard />
 * </FeatureGate>
 */
interface FeatureGateProps {
  /** Feature flag to check */
  flag: string;
  /** Content to render when flag is enabled */
  children: ReactNode;
  /** Content to render when flag is disabled */
  fallback?: ReactNode;
  /** Invert the condition (render when disabled) */
  invert?: boolean;
}

export function FeatureGate({
  flag,
  children,
  fallback = null,
  invert = false,
}: FeatureGateProps) {
  const { isEnabled } = useFeatureFlagContext();

  const enabled = isEnabled(flag);
  const shouldRender = invert ? !enabled : enabled;

  return <>{shouldRender ? children : fallback}</>;
}

/**
 * Component for A/B test rendering
 *
 * @example
 * <ABTestGate flag="FF_AB_LANDING_PAGE">
 *   <ABTestGate.Variant name="control">
 *     <LandingControl />
 *   </ABTestGate.Variant>
 *   <ABTestGate.Variant name="variant_a">
 *     <LandingA />
 *   </ABTestGate.Variant>
 *   <ABTestGate.Variant name="variant_b">
 *     <LandingB />
 *   </ABTestGate.Variant>
 * </ABTestGate>
 */
interface ABTestGateProps {
  /** A/B test flag name */
  flag: string;
  /** Variant components as children */
  children: ReactNode;
}

interface VariantProps {
  /** Variant name to match */
  name: string;
  /** Content to render for this variant */
  children: ReactNode;
}

function Variant({ children }: VariantProps) {
  return <>{children}</>;
}

export function ABTestGate({ flag, children }: ABTestGateProps) {
  const { getVariant } = useFeatureFlagContext();
  const currentVariant = getVariant(flag, 'control');

  // Find the matching variant child
  const childArray = React.Children.toArray(children);
  const matchingChild = childArray.find((child) => {
    if (React.isValidElement<VariantProps>(child)) {
      return child.props.name === currentVariant;
    }
    return false;
  });

  // Fall back to first child (usually control) if no match
  return <>{matchingChild || childArray[0]}</>;
}

// Attach Variant as a static property
ABTestGate.Variant = Variant;

/**
 * Debug component to display current flag values
 * Only renders in development mode
 */
export function FeatureFlagDebug() {
  const { flags, isLoading, isError } = useFeatureFlagContext();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: '#1a1a2e',
        color: '#eee',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        maxHeight: '300px',
        overflow: 'auto',
        zIndex: 9999,
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
        Feature Flags {isLoading && '(loading...)'} {isError && '(error)'}
      </div>
      {Object.entries(flags).map(([name, value]) => (
        <div
          key={name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <span>{name}:</span>
          <span style={{ color: value ? '#4ade80' : '#f87171' }}>
            {String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default FeatureFlagProvider;
