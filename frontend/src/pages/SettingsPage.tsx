/**
 * Settings Page
 *
 * Story 9B-4: Settings Page -- account preferences, notification toggles,
 * and display settings for the Equoria application.
 *
 * Wired to real user data via useProfile/useUpdateProfile hooks.
 * Account fields populated from authenticated user profile.
 * Password change calls /api/auth/change-password.
 * Delete account calls DELETE /api/users/:id.
 * Notification and display preferences persist server-side via
 * PUT /api/auth/profile (User.settings.notifications / display).
 *
 * Sections:
 * 1. Account -- username, email, password change, delete account
 * 2. Notifications -- email and in-app notification toggles (backend)
 * 3. Display -- theme and accessibility preferences (backend)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User, Bell, Monitor, ChevronRight, Settings, Loader2 } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { cn } from '@/lib/utils';
import {
  useProfile,
  useUpdateProfile,
  useChangePassword,
  useDeleteAccount,
  useLogout,
} from '../hooks/useAuth';

// ── Default preference values ───────────────────────────────────────────────

type NotificationPrefs = {
  emailCompetition: boolean;
  emailBreeding: boolean;
  emailSystem: boolean;
  inAppTraining: boolean;
  inAppAchievements: boolean;
  inAppNews: boolean;
};

type DisplayPrefs = {
  reducedMotion: boolean;
  highContrast: boolean;
  compactCards: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  emailCompetition: true,
  emailBreeding: false,
  emailSystem: true,
  inAppTraining: true,
  inAppAchievements: true,
  inAppNews: false,
};

const DEFAULT_DISPLAY: DisplayPrefs = {
  reducedMotion: false,
  highContrast: false,
  compactCards: false,
};

function mergePrefs<T extends Record<string, boolean>>(
  defaults: T,
  serverValue: Record<string, unknown> | null | undefined
): T {
  const result: Record<string, boolean> = { ...defaults };
  if (serverValue && typeof serverValue === 'object') {
    for (const key of Object.keys(defaults)) {
      const v = serverValue[key];
      if (typeof v === 'boolean') {
        result[key] = v;
      }
    }
  }
  return result as T;
}

// ── Toggle component ────────────────────────────────────────────────────────

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
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-[var(--bg-night-sky)] shadow',
          'transition-transform duration-200 ease-in-out',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  </label>
);

// ── Section nav config ──────────────────────────────────────────────────────

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

// ── Main component ──────────────────────────────────────────────────────────

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('account');

  // ── Auth hooks ──────────────────────────────────────────────────────────
  const { data: profileData, isLoading: isProfileLoading } = useProfile();
  const { mutate: updateProfile, isPending: isSaving } = useUpdateProfile();
  const { mutate: changePassword, isPending: isChangingPassword } = useChangePassword();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();
  const { mutate: logout } = useLogout();

  const user = profileData?.user;

  // ── Account form state ──────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [accountStatus, setAccountStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ── Password form state ─────────────────────────────────────────────────
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ── Delete account confirmation state ───────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // ── Notification & display prefs (backend-persisted) ────────────────────
  const [notifications, setNotifications] = useState<NotificationPrefs>(DEFAULT_NOTIFICATIONS);
  const [display, setDisplay] = useState<DisplayPrefs>(DEFAULT_DISPLAY);
  const [prefsStatus, setPrefsStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // ── Populate form state from backend profile data ───────────────────────
  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
      setNotifications(
        mergePrefs(DEFAULT_NOTIFICATIONS, user.notifications as Record<string, unknown> | null)
      );
      setDisplay(mergePrefs(DEFAULT_DISPLAY, user.display as Record<string, unknown> | null));
    }
  }, [user]);

  // ── Persist preferences to backend on change ────────────────────────────
  const persistPrefs = useCallback(
    (payload: { notifications?: NotificationPrefs; display?: DisplayPrefs }) => {
      updateProfile(payload, {
        onSuccess: () => {
          setPrefsStatus({ type: 'success', message: 'Preferences saved.' });
          setTimeout(() => setPrefsStatus(null), 2000);
        },
        onError: (error) => {
          setPrefsStatus({
            type: 'error',
            message:
              error?.message ?? 'Failed to save preferences. Your changes were not persisted.',
          });
        },
      });
    },
    [updateProfile]
  );

  // ── Account save handler ────────────────────────────────────────────────
  const handleSaveAccount = useCallback(() => {
    if (!username.trim()) {
      setAccountStatus({ type: 'error', message: 'Username cannot be empty.' });
      return;
    }

    const updates: { username?: string; email?: string } = {};
    if (username !== user?.username) updates.username = username.trim();
    if (email !== user?.email) updates.email = email.trim();

    if (Object.keys(updates).length === 0) {
      setAccountStatus({ type: 'success', message: 'No changes to save.' });
      setTimeout(() => setAccountStatus(null), 3000);
      return;
    }

    updateProfile(updates, {
      onSuccess: () => {
        setAccountStatus({ type: 'success', message: 'Profile updated successfully.' });
        setTimeout(() => setAccountStatus(null), 3000);
      },
      onError: (error) => {
        setAccountStatus({
          type: 'error',
          message: error?.message ?? 'Failed to update profile.',
        });
      },
    });
  }, [username, email, user, updateProfile]);

  // ── Password change handler ─────────────────────────────────────────────
  const handleChangePassword = useCallback(() => {
    setPasswordStatus(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'All password fields are required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordStatus({
        type: 'error',
        message: 'New password must be at least 8 characters.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    changePassword(
      { oldPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordStatus({
            type: 'success',
            message: 'Password changed. You will be logged out of all sessions.',
          });
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
          // The backend invalidates all sessions -- log out after a short delay
          setTimeout(() => logout(undefined), 2000);
        },
        onError: (error) => {
          setPasswordStatus({
            type: 'error',
            message: error?.message ?? 'Failed to change password.',
          });
        },
      }
    );
  }, [oldPassword, newPassword, confirmPassword, changePassword, logout]);

  // ── Delete account handler ──────────────────────────────────────────────
  const handleDeleteAccount = useCallback(() => {
    if (!user?.id) return;
    deleteAccount(user.id, {
      onError: (error) => {
        setAccountStatus({
          type: 'error',
          message: error?.message ?? 'Failed to delete account.',
        });
        setShowDeleteConfirm(false);
        setDeleteConfirmText('');
      },
    });
  }, [user, deleteAccount]);

  // ── Notification toggle helpers (persist to backend) ────────────────────
  const setNotif = (key: keyof NotificationPrefs) => (val: boolean) => {
    const next = { ...notifications, [key]: val };
    setNotifications(next);
    persistPrefs({ notifications: next });
  };

  // ── Display toggle helpers (persist to backend) ─────────────────────────
  const setDisp = (key: keyof DisplayPrefs) => (val: boolean) => {
    const next = { ...display, [key]: val };
    setDisplay(next);
    persistPrefs({ display: next });
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (isProfileLoading) {
    return (
      <div className="min-h-screen" data-testid="settings-page">
        <PageHero
          title="Settings"
          subtitle="Manage your account preferences and application settings."
          mood="default"
          icon={<Settings className="w-7 h-7 text-[var(--gold-400)]" aria-hidden="true" />}
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-celestial-gold" />
          <span className="ml-3 text-white/60 text-sm">Loading settings...</span>
        </div>
      </div>
    );
  }

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
                  : 'text-white/60 hover:text-[var(--text-primary)] hover:bg-white/5'
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Account Settings</h2>

              {/* Status banner */}
              {accountStatus && (
                <div
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm',
                    accountStatus.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  )}
                  data-testid="settings-account-status"
                >
                  {accountStatus.message}
                </div>
              )}

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
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveAccount}
                  disabled={isSaving}
                  className={cn(
                    'px-4 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-celestial-gold text-sm font-medium transition-colors',
                    isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-celestial-gold/20'
                  )}
                  data-testid="settings-save-account"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>

              {/* Password change section */}
              <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-medium text-white/70 mb-3">Change Password</h3>

                {!showPasswordForm ? (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
                    data-testid="settings-update-password"
                  >
                    Update Password
                  </button>
                ) : (
                  <div className="space-y-3 max-w-sm">
                    {/* Password status banner */}
                    {passwordStatus && (
                      <div
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm',
                          passwordStatus.type === 'success'
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                            : 'bg-red-500/10 border border-red-500/30 text-red-400'
                        )}
                        data-testid="settings-password-status"
                      >
                        {passwordStatus.message}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="settings-old-password"
                        className="block text-xs font-medium text-white/60 mb-1"
                      >
                        Current Password
                      </label>
                      <input
                        id="settings-old-password"
                        type="password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                        autoComplete="current-password"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="settings-new-password"
                        className="block text-xs font-medium text-white/60 mb-1"
                      >
                        New Password
                      </label>
                      <input
                        id="settings-new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                        autoComplete="new-password"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="settings-confirm-password"
                        className="block text-xs font-medium text-white/60 mb-1"
                      >
                        Confirm New Password
                      </label>
                      <input
                        id="settings-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className={cn(
                          'px-4 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-celestial-gold text-sm font-medium transition-colors',
                          isChangingPassword
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-celestial-gold/20'
                        )}
                        data-testid="settings-confirm-password-change"
                      >
                        {isChangingPassword ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Changing...
                          </span>
                        ) : (
                          'Change Password'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setOldPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                          setPasswordStatus(null);
                        }}
                        className="px-4 py-2 rounded-lg text-white/50 text-sm hover:text-white/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger zone: delete account */}
              <div className="border-t border-red-900/30 pt-6">
                <h3 className="text-sm font-medium text-red-400 mb-1">Danger Zone</h3>
                <p className="text-xs text-white/40 mb-3">
                  Permanently delete your account and all data. This cannot be undone.
                </p>

                {!showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
                    data-testid="settings-delete-account"
                  >
                    Delete Account
                  </button>
                ) : (
                  <div className="space-y-3 max-w-sm">
                    <p className="text-xs text-red-400/80">
                      Type <strong>DELETE</strong> to confirm account deletion.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="w-full rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2 text-sm text-red-300 placeholder:text-red-400/30 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                      data-testid="settings-delete-confirm-input"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                        className={cn(
                          'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                          deleteConfirmText === 'DELETE' && !isDeleting
                            ? 'border-red-500 bg-red-500/20 text-red-400 hover:bg-red-500/30'
                            : 'border-red-500/20 text-red-400/40 cursor-not-allowed'
                        )}
                        data-testid="settings-confirm-delete"
                      >
                        {isDeleting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Deleting...
                          </span>
                        ) : (
                          'Permanently Delete'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        className="px-4 py-2 rounded-lg text-white/50 text-sm hover:text-white/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div
              className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md p-6 space-y-6"
              data-testid="settings-notifications"
            >
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Notification Preferences
              </h2>

              {prefsStatus && (
                <div
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm',
                    prefsStatus.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  )}
                  data-testid="settings-prefs-status"
                >
                  {prefsStatus.message}
                </div>
              )}

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
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Display Settings</h2>

              {prefsStatus && (
                <div
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm',
                    prefsStatus.type === 'success'
                      ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                      : 'bg-red-500/10 border border-red-500/30 text-red-400'
                  )}
                  data-testid="settings-prefs-status"
                >
                  {prefsStatus.message}
                </div>
              )}

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
