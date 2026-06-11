/**
 * Settings constants + shared Toggle (extracted from SettingsPage — Equoria-qk3vi)
 *
 * The reusable Toggle switch, the sidebar `sections` config, the
 * DEFAULT_PREFERENCES baseline, and the notification/display key unions.
 * Extracted verbatim so the page container and its section components share
 * one source of truth. Uses JSX (section icons + Toggle) so this is .tsx.
 */

import React from 'react';
import { User, Bell, Monitor, Volume2 } from 'lucide-react';
import { Switch } from '@/components/ui/form';
import type { UserPreferences } from '@/lib/api-client';

export interface ToggleProps {
  checked: boolean;
  onChange: (_checked: boolean) => void;
  label: string;
  description?: string;
  testId?: string;
}

/**
 * Toggle — settings row composing the canonical Switch (Equoria-o5hub.22).
 * The local hand-rolled switch button was replaced by the design-system
 * Switch primitive; this wrapper only owns the label/description row layout.
 * The wrapping <label> keeps implicit label→control activation (clicking the
 * text toggles the switch), matching the pre-migration behavior, and the
 * e2e contract (`[data-testid] button[role="switch"]`) is preserved because
 * Switch renders a button[role=switch].
 */
export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  testId,
}) => (
  <label
    className="flex items-center justify-between py-3 cursor-pointer group"
    data-testid={testId}
  >
    <div className="flex-1 pr-4">
      <p className="text-sm font-medium text-role-primary">{label}</p>
      {description && <p className="text-xs text-role-muted mt-0.5">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </label>
);

export interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
}

export const sections: SettingsSection[] = [
  { id: 'account', title: 'Account', icon: <User className="w-4 h-4" /> },
  { id: 'notifications', title: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'display', title: 'Display', icon: <Monitor className="w-4 h-4" /> },
  { id: 'sound', title: 'Sound', icon: <Volume2 className="w-4 h-4" /> },
];

/**
 * Defaults applied when the account has never saved a preference. Kept in
 * sync with the server's ALLOWED_PREFERENCE_KEYS (Story 21S-5).
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  emailCompetition: true,
  emailBreeding: false,
  emailSystem: true,
  inAppTraining: true,
  inAppAchievements: true,
  inAppNews: false,
  reducedMotion: false,
  highContrast: false,
  compactCards: false,
  soundEnabled: false,
};

export type NotificationKey =
  | 'emailCompetition'
  | 'emailBreeding'
  | 'emailSystem'
  | 'inAppTraining'
  | 'inAppAchievements'
  | 'inAppNews';
export type DisplayKey = 'reducedMotion' | 'highContrast' | 'compactCards';
