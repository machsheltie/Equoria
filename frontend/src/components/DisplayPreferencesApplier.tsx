/**
 * DisplayPreferencesApplier (Equoria-apfwp, ACC-04)
 *
 * Renders nothing. Keeps the document root's display attributes in step with
 * the signed-in player's saved Display switches (reduced motion, high contrast,
 * compact cards), so a switch takes effect the moment it is flipped (the
 * preference mutation updates the cached profile optimistically) and on every
 * later visit. Signing out clears them.
 */

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { applyDisplayPreferences } from '@/lib/displayPreferences';

export function DisplayPreferencesApplier(): null {
  const { user } = useAuth();
  const reducedMotion = user?.preferences?.reducedMotion === true;
  const highContrast = user?.preferences?.highContrast === true;
  const compactCards = user?.preferences?.compactCards === true;

  useEffect(() => {
    applyDisplayPreferences({ reducedMotion, highContrast, compactCards });
  }, [reducedMotion, highContrast, compactCards]);

  useEffect(() => () => applyDisplayPreferences(null), []);

  return null;
}

export default DisplayPreferencesApplier;
