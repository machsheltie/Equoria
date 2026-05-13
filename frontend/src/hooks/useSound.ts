/**
 * useSound — Epic 30
 *
 * React hook providing sound playback and settings management.
 * Checks localStorage for user preference (default: off).
 * Respects prefers-reduced-motion system setting.
 *
 * Usage:
 *   const { soundEnabled, setSoundEnabled, playSound } = useSound();
 *   // In a click handler:
 *   playSound('click');
 */

import { useState, useCallback } from 'react';
import {
  playSound as playSoundImpl,
  getSoundEnabled,
  setSoundEnabled as persistSoundEnabled,
} from '../lib/soundManager';

type SoundVariant = 'click' | 'success' | 'cooldown' | 'trait-discovery' | 'foal-birth' | 'cup-win';

interface UseSoundReturn {
  /** Whether sound effects are currently enabled */
  soundEnabled: boolean;
  /** Update and persist the sound enabled preference */
  setSoundEnabled: (_enabled: boolean) => void;
  /** Play a sound effect if sound is enabled */
  playSound: (_variant: SoundVariant) => void;
}

export function useSound(): UseSoundReturn {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => getSoundEnabled());

  const setSoundEnabled = useCallback((enabled: boolean) => {
    persistSoundEnabled(enabled);
    setSoundEnabledState(enabled);
  }, []);

  const playSound = useCallback((variant: SoundVariant) => {
    // isSoundActive() inside playSoundImpl reads localStorage on each call
    playSoundImpl(variant).catch(() => {
      /* non-critical */
    });
  }, []);

  return { soundEnabled, setSoundEnabled, playSound };
}
