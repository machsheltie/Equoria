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
import { cn } from '@/lib/utils';
import type { UserPreferences } from '@/lib/api-client';

export interface ToggleProps {
  checked: boolean;
  onChange: (_checked: boolean) => void;
  label: string;
  description?: string;
  testId?: string;
}

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
      <p className="text-sm font-medium text-white/90">{label}</p>
      {description && <p className="text-xs text-white/50 mt-0.5">{description}</p>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-celestial-gold/50',
        checked ? 'bg-celestial-gold' : 'bg-white/20'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-[var(--bg-night-sky)] shadow',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
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
