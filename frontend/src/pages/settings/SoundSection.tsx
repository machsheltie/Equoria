/**
 * SoundSection (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Presentational sound-settings panel: the master sound-effects toggle plus
 * a preview-buttons row shown when sound is enabled. State (soundEnabled,
 * playSound) and the persist handler live in the SettingsPage container.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
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
  <Surface variant="panel" className="space-y-6" data-testid="settings-sound">
    <h2 className="type-section-heading">Sound Settings</h2>

    <p className="text-xs text-role-muted">
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
      <div className="border-t border-[var(--glass-border)] pt-4">
        <p className="text-xs text-role-muted mb-3">Preview sounds</p>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_SOUNDS.map(({ variant, label }) => (
            <Button
              key={variant}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => playSound(variant)}
              data-testid={`sound-preview-${variant}`}
            >
              ▶ {label}
            </Button>
          ))}
        </div>
      </div>
    )}
  </Surface>
);
