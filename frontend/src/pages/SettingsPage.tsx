/**
 * Settings Page
 *
 * Story 9B-4: Settings Page — account preferences, notification toggles,
 * and display settings for the Equoria application.
 *
 * Sections:
 * 1. Account — username, email, password change
 * 2. Notifications — email and in-app notification toggles
 * 3. Display — theme and accessibility preferences
 */

import React, { useState } from 'react';
import { User, Bell, Monitor, ChevronRight, Settings } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { cn } from '@/lib/utils';

interface ToggleProps {
  checked: boolean;
  onChange: (_checked: boolean) => void;
  label: string;
  description?: string;
  testId?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description, testId }) => (
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
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  </label>
);

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ReactNode;
}

const sections: SettingsSection[] = [
  { id: 'account', title: 'Account', icon: <User className="w-4 h-4" /> },
  { id: 'notifications', title: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { id: 'display', title: 'Display', icon: <Monitor className="w-4 h-4" /> },
];

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('account');
  const [savedAccount, setSavedAccount] = useState(false);

  const handleSaveAccount = () => {
    setSavedAccount(true);
    setTimeout(() => setSavedAccount(false), 2000);
  };

  const [notifications, setNotifications] = useState({
    emailCompetition: true,
    emailBreeding: false,
    emailSystem: true,
    inAppTraining: true,
    inAppAchievements: true,
    inAppNews: false,
  });

  const [display, setDisplay] = useState({
    reducedMotion: false,
    highContrast: false,
    compactCards: false,
  });

  const setNotif = (key: keyof typeof notifications) => (val: boolean) =>
    setNotifications((prev) => ({ ...prev, [key]: val }));

  const setDisp = (key: keyof typeof display) => (val: boolean) =>
    setDisplay((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="min-h-screen" data-testid="settings-page">
      <PageHero
        title="Settings"
        subtitle="Manage your account preferences and application settings."
        mood="default"
        icon={<Settings className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <nav
          className="md:col-span-1 space-y-1"
          aria-label="Settings sections"
          data-testid="settings-nav"
        >
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                activeSection === section.id
                  ? 'bg-white/10 text-celestial-gold border border-white/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
              data-testid={`settings-nav-${section.id}`}
            >
              <span className="flex items-center gap-2">
                {section.icon}
                {section.title}
              </span>
              {activeSection === section.id && (
                <ChevronRight className="w-3 h-3 text-celestial-gold/60" />
              )}
            </button>
          ))}
        </nav>

        {/* Section Content */}
        <div className="md:col-span-3">
          {/* Account Section */}
          {activeSection === 'account' && (
            <div
              className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-6 space-y-6"
              data-testid="settings-account"
            >
              <h2 className="text-lg font-semibold text-white">Account Settings</h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="settings-username"
                    className="block text-sm font-medium text-white/70 mb-1.5"
                  >
                    Username
                  </label>
                  <input
                    id="settings-username"
                    type="text"
                    defaultValue="NobleRider"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-email"
                    className="block text-sm font-medium text-white/70 mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="settings-email"
                    type="email"
                    defaultValue="rider@equoria.com"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveAccount}
                  className="px-4 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-celestial-gold text-sm font-medium hover:bg-celestial-gold/20 transition-colors"
                  data-testid="settings-save-account"
                >
                  {savedAccount ? 'Saved ✓' : 'Save Changes'}
                </button>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-medium text-white/70 mb-3">Change Password</h3>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Update Password
                </button>
              </div>

              <div className="border-t border-red-900/30 pt-6">
                <h3 className="text-sm font-medium text-red-400 mb-1">Danger Zone</h3>
                <p className="text-xs text-white/40 mb-3">
                  Permanently delete your account and all data. This cannot be undone.
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
                  data-testid="settings-delete-account"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div
              className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-6 space-y-6"
              data-testid="settings-notifications"
            >
              <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>

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
          )}

          {/* Display Section */}
          {activeSection === 'display' && (
            <div
              className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-6 space-y-6"
              data-testid="settings-display"
            >
              <h2 className="text-lg font-semibold text-white">Display Settings</h2>

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
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
