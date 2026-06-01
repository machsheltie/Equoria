/**
 * SoundSection (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Presentational sound-settings panel: the master sound-effects toggle plus
 * a preview-buttons row shown when sound is enabled. State (soundEnabled,
 * playSound) and the persist handler live in the SettingsPage container.
 */

import React from 'react';
import { Toggle } from './constants';

export interface SoundSectionProps {
  /** Effective checked state for the master toggle (merged.soundEnabled ?? soundEnabled). */
  soundChecked: boolean;
  /** Whether the preview row is shown (the live soundEnabled hook value). */
  soundEnabled: boolean;
  onToggleSound: (_val: boolean) => void;
  playSound: (_variant: string) => void;
}

const PREVIEW_SOUNDS = [
  { variant: 'click', label: 'Click' },
  { variant: 'success', label: 'Success' },
  { variant: 'cooldown', label: 'Cooldown' },
  { variant: 'trait-discovery', label: 'Trait Discovery' },
  { variant: 'foal-birth', label: 'Foal Birth' },
  { variant: 'cup-win', label: 'Cup Win' },
] as const;

export const SoundSection: React.FC<SoundSectionProps> = ({
  soundChecked,
  soundEnabled,
  onToggleSound,
  playSound,
}) => (
  <div className="glass-panel space-y-6" data-testid="settings-sound">
    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Sound Settings</h2>

    <p className="text-xs text-white/50">
      Sound effects are <strong>off by default</strong>. Enable them to hear UI feedback, training
      completion chimes, and celebration sounds for special events. If your system has{' '}
      <em>Reduce Motion</em> enabled, sounds will remain silent regardless of this setting.
    </p>

    <div className="space-y-1">
      <Toggle
        label="Sound Effects"
        description="Enable UI sounds, cooldown chimes, and celebration audio"
        checked={soundChecked}
        onChange={onToggleSound}
        testId="sound-effects-toggle"
      />
    </div>

    {soundEnabled && (
      <div className="border-t border-white/10 pt-4">
        <p className="text-xs text-white/40 mb-3">Preview sounds</p>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_SOUNDS.map(({ variant, label }) => (
            <button
              key={variant}
              onClick={() => playSound(variant)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition-colors"
              data-testid={`sound-preview-${variant}`}
            >
              ▶ {label}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
);
