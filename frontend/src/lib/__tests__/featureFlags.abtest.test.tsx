/**
 * featureFlags — useABTest console-leak regression (Equoria-o7c0x L5 / CWE-532)
 *
 * Sentinel-positive test: verifies that calling trackConversion() does NOT
 * emit variant-assignment data to console.log (which would leak A/B info to
 * the browser console in production builds — CWE-532 information exposure).
 *
 * Pattern: spy on console.log BEFORE rendering; call trackConversion; assert
 * the spy was never called. The spy is verified to work by confirming it
 * captures a control console.log call in the same test.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useABTest } from '../featureFlags';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useABTest — no console.log on trackConversion (Equoria-o7c0x L5)', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('spy itself works — captures a direct console.log call', () => {
    console.log('sentinel');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('sentinel');
  });

  it('trackConversion does not call console.log (no variant-assignment leak)', async () => {
    const { result } = renderHook(() => useABTest('FF_AB_TEST_EXAMPLE', ['control', 'variant_a']), {
      wrapper,
    });

    await act(async () => {
      result.current.trackConversion();
    });

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('returns the variant string from the hook (functional smoke-test)', () => {
    const { result } = renderHook(() => useABTest('FF_AB_TEST_EXAMPLE', ['control', 'variant_a']), {
      wrapper,
    });

    // With no backend flag set the hook falls back to the first variant (default)
    expect(typeof result.current.variant).toBe('string');
    expect(typeof result.current.trackConversion).toBe('function');
  });
});
