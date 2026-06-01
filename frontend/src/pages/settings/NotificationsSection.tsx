/**
 * NotificationsSection (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Presentational notification-preferences panel: email + in-app toggles.
 * Receives the current values and a key-based setter factory from the
 * SettingsPage container.
 */

import React from 'react';
import { Toggle, type NotificationKey } from './constants';

export interface NotificationsSectionProps {
  notifications: Record<NotificationKey, boolean>;
  setNotif: (_key: NotificationKey) => (_val: boolean) => void;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  notifications,
  setNotif,
}) => (
  <div className="glass-panel space-y-6" data-testid="settings-notifications">
    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Notification Preferences</h2>

    <div className="space-y-1">
      <h3 className="text-xs uppercase tracking-widest text-white/40 font-medium mb-2 pb-1 border-b border-white/5">
        Email Notifications
      </h3>
      <Toggle
        label="Competition Results"
        description="Receive results when your horse completes a competition"
        checked={notifications.emailCompetition}
        onChange={setNotif('emailCompetition')}
        testId="notif-email-competition"
      />
      <Toggle
        label="Breeding Updates"
        description="Notifications for foal births and breeding cooldown completions"
        checked={notifications.emailBreeding}
        onChange={setNotif('emailBreeding')}
        testId="notif-email-breeding"
      />
      <Toggle
        label="System Announcements"
        description="Important updates about the game and maintenance windows"
        checked={notifications.emailSystem}
        onChange={setNotif('emailSystem')}
        testId="notif-email-system"
      />
    </div>

    <div className="space-y-1">
      <h3 className="text-xs uppercase tracking-widest text-white/40 font-medium mb-2 pb-1 border-b border-white/5">
        In-App Notifications
      </h3>
      <Toggle
        label="Training Cooldown Ready"
        description="Alert when a horse's training cooldown expires"
        checked={notifications.inAppTraining}
        onChange={setNotif('inAppTraining')}
        testId="notif-inapp-training"
      />
      <Toggle
        label="Achievements"
        description="Notifications for milestones and level-ups"
        checked={notifications.inAppAchievements}
        onChange={setNotif('inAppAchievements')}
        testId="notif-inapp-achievements"
      />
      <Toggle
        label="News & Events"
        description="Tournament announcements and game news"
        checked={notifications.inAppNews}
        onChange={setNotif('inAppNews')}
        testId="notif-inapp-news"
      />
    </div>
  </div>
);
