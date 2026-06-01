/**
 * DisplaySection (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Presentational display-preferences panel: reduced motion, high contrast,
 * compact cards. Receives the current values and a key-based setter factory
 * from the SettingsPage container.
 */

import React from 'react';
import { Toggle, type DisplayKey } from './constants';

export interface DisplaySectionProps {
  display: Record<DisplayKey, boolean>;
  setDisp: (_key: DisplayKey) => (_val: boolean) => void;
}

export const DisplaySection: React.FC<DisplaySectionProps> = ({ display, setDisp }) => (
  <div className="glass-panel space-y-6" data-testid="settings-display">
    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Display Settings</h2>

    <div className="space-y-1">
      <Toggle
        label="Reduced Motion"
        description="Minimise animations throughout the interface"
        checked={display.reducedMotion}
        onChange={setDisp('reducedMotion')}
        testId="display-reduced-motion"
      />
      <Toggle
        label="High Contrast"
        description="Increase contrast for better readability"
        checked={display.highContrast}
        onChange={setDisp('highContrast')}
        testId="display-high-contrast"
      />
      <Toggle
        label="Compact Cards"
        description="Show smaller horse cards in list views to fit more on screen"
        checked={display.compactCards}
        onChange={setDisp('compactCards')}
        testId="display-compact-cards"
      />
    </div>
  </div>
);
