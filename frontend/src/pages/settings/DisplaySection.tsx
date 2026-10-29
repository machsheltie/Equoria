/**
 * DisplaySection (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Presentational display-preferences panel: reduced motion, high contrast,
 * compact cards. Receives the current values and a key-based setter factory
 * from the SettingsPage container.
 */

import React from 'react';
import { Surface } from '@/components/ui/Surface';
import { InlineError } from '@/components/ui/state';
import { Toggle, type DisplayKey } from './constants';

export interface DisplaySectionProps {
  display: Record<DisplayKey, boolean>;
  setDisp: (_key: DisplayKey) => (_val: boolean) => void;
  /** A refused save, shown beside its own switch (q161; Equoria-c1sg6). */
  saveError?: { key: string; message: string } | null;
}

function errorBeside(
  saveError: DisplaySectionProps['saveError'],
  key: DisplayKey
): React.ReactNode {
  return saveError?.key === key ? <InlineError message={saveError.message} /> : null;
}

export const DisplaySection: React.FC<DisplaySectionProps> = ({ display, setDisp, saveError }) => (
  <Surface variant="panel" className="space-y-6" data-testid="settings-display">
    <h2 className="type-section-heading">Display Settings</h2>

    <div className="space-y-1">
      <Toggle
        label="Reduced Motion"
        description="Minimize animations throughout the interface"
        checked={display.reducedMotion}
        onChange={setDisp('reducedMotion')}
        testId="display-reduced-motion"
      />
      {errorBeside(saveError, 'reducedMotion')}
      <Toggle
        label="High Contrast"
        description="Increase contrast for better readability"
        checked={display.highContrast}
        onChange={setDisp('highContrast')}
        testId="display-high-contrast"
      />
      {errorBeside(saveError, 'highContrast')}
      <Toggle
        label="Compact Cards"
        description="Show smaller horse cards in list views to fit more on screen"
        checked={display.compactCards}
        onChange={setDisp('compactCards')}
        testId="display-compact-cards"
      />
      {errorBeside(saveError, 'compactCards')}
    </div>
  </Surface>
);
