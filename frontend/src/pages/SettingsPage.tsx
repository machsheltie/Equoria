/**
 * Settings Page
 *
 * Story 9B-4: Settings Page — account preferences, notification toggles,
 * and display settings for the Equoria application.
 *
 * Sections:
 * 1. Account — username, email, password change, delete account
 * 2. Notifications — email and in-app notification toggles
 * 3. Display — theme and accessibility preferences
 *
 * Equoria-ocn9 (2026-04-23): Account section is no longer a façade.
 * - Inputs are controlled and seeded from useAuth().user.
 * - Save Changes calls useUpdateProfile() (PUT /api/auth/profile).
 * - Update Password reveals an inline form and calls useChangePassword()
 *   (POST /api/auth/change-password). On success the server invalidates all
 *   sessions; we sign the user out client-side to match.
 * - Delete Account opens a typed-confirmation modal and calls
 *   useDeleteAccount() (DELETE /api/users/:id). The hook clears React Query
 *   cache and redirects to /login on success.
 */

import React, { useEffect, useRef, useState } from 'react';
import { User, Bell, Monitor, ChevronRight, Settings } from 'lucide-react';
import { toast } from 'sonner';
import PageHero from '@/components/layout/PageHero';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdatePreferences } from '@/hooks/api/useUpdatePreferences';
import { useUpdateProfile, useChangePassword, useDeleteAccount, useLogout } from '@/hooks/useAuth';
import type { UserPreferences } from '@/lib/api-client';

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

/**
 * Defaults applied when the account has never saved a preference. Kept in
 * sync with the server's ALLOWED_PREFERENCE_KEYS (Story 21S-5).
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  emailCompetition: true,
  emailBreeding: false,
  emailSystem: true,
  inAppTraining: true,
  inAppAchievements: true,
  inAppNews: false,
  reducedMotion: false,
  highContrast: false,
  compactCards: false,
};

type NotificationKey =
  | 'emailCompetition'
  | 'emailBreeding'
  | 'emailSystem'
  | 'inAppTraining'
  | 'inAppAchievements'
  | 'inAppNews';
type DisplayKey = 'reducedMotion' | 'highContrast' | 'compactCards';

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('account');

  const { user } = useAuth();
  const updatePreferences = useUpdatePreferences();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();
  const logout = useLogout();

  // -------- Account form state (controlled, seeded from user) --------
  const [username, setUsername] = useState<string>(user?.username ?? '');
  const [email, setEmail] = useState<string>(user?.email ?? '');

  // Equoria-ocn9 review fix: re-sync the local form state from the server
  // ONLY when the local state still matches the value we last seeded.
  // Tracking the last-seeded value (not just "non-empty") fixes two bugs
  // the original `prev === ''` check produced:
  //   1. Clearing a field intentionally would be undone on the next user
  //      object refetch (focus refetch is common with React Query).
  //   2. After a save, server-side normalization (trim/lowercase) was
  //      never reflected back into the form, so subsequent saves
  //      re-submitted the user's un-normalized text indefinitely.
  // With this pattern: the form is always in sync with the server until
  // the user starts typing; once they type, the form holds their input
  // until they save (or until the user switches identity entirely).
  const lastSeededRef = useRef<{ username: string; email: string }>({
    username: user?.username ?? '',
    email: user?.email ?? '',
  });
  useEffect(() => {
    if (!user) return;
    setUsername((prev) => (prev === lastSeededRef.current.username ? (user.username ?? '') : prev));
    setEmail((prev) => (prev === lastSeededRef.current.email ? (user.email ?? '') : prev));
    lastSeededRef.current = {
      username: user.username ?? '',
      email: user.email ?? '',
    };
  }, [user]);

  const handleSaveAccount = () => {
    if (!user) return;
    const updates: { username?: string; email?: string } = {};
    if (username.trim() && username !== user.username) updates.username = username.trim();
    if (email.trim() && email !== user.email) updates.email = email.trim();
    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save.');
      return;
    }
    updateProfile.mutate(updates, {
      // Equoria-ocn9 review fix: surface a success toast. The original
      // implementation only handled onError, leaving users with no
      // confirmation that the save worked.
      onSuccess: () => {
        toast.success('Account changes saved.');
      },
      onError: (err) => {
        toast.error(err?.message ?? 'Could not save account changes.');
      },
    });
  };

  // -------- Password change form state --------
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const resetPasswordForm = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordForm(false);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('All password fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (newPassword === oldPassword) {
      toast.error('New password must differ from the current password.');
      return;
    }
    changePassword.mutate(
      { oldPassword, newPassword },
      {
        onSuccess: () => {
          toast.success(
            'Password changed. You will be signed out — please log in with your new password.'
          );
          resetPasswordForm();
          // Equoria-ocn9 review fix: the server invalidates all sessions on
          // a password change (CWE-613). The client must follow. Previously
          // we called `logout.mutate()` and left it at that — but if logout
          // failed (e.g. CSRF token already invalidated, network blip), the
          // user would be left in a zombie state: client thinks logged-in,
          // server returns 401 to every request, no recovery path.
          // Hard-redirect to /login regardless of mutate outcome.
          logout.mutate(undefined, {
            onSettled: () => {
              window.location.href = '/login';
            },
          });
        },
        onError: (err) => {
          toast.error(err?.message ?? 'Could not change password.');
        },
      }
    );
  };

  // -------- Delete account modal state --------
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  // Equoria-ocn9 re-review fix: track whether the mousedown that started a
  // potential backdrop click actually landed on the backdrop. Used by the
  // mouseup handler to skip drag-out cases (mousedown inside, mouseup outside).
  const backdropMouseDownRef = useRef(false);

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = () => {
    if (!user) return;
    // Equoria-ocn9 review fix: trim the confirmation input. Browser autofill
    // may add a trailing space; a literal !== comparison would block delete
    // for users who typed the right username with whitespace.
    if (deleteConfirmText.trim() !== user.username) {
      toast.error('Confirmation text does not match your username.');
      return;
    }
    deleteAccount.mutate(user.id, {
      onError: (err) => {
        toast.error(err?.message ?? 'Could not delete account.');
      },
      // onSuccess is handled inside the hook (clears cache, redirects).
    });
  };

  // Equoria-ocn9 review fix: ARIA dialogs must dismiss on Escape. Without
  // this handler, keyboard-only users have no way out of the modal except
  // tabbing to Cancel — a WCAG 2.1.2 violation.
  useEffect(() => {
    if (!showDeleteModal) return;
    const onKey = (e: KeyboardEvent) => {
      // Inline the close logic to keep this effect's deps minimal —
      // closeDeleteModal is a fresh function reference each render.
      if (e.key === 'Escape') {
        setShowDeleteModal(false);
        setDeleteConfirmText('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeleteModal]);

  // -------- Preferences (notifications + display) --------
  const merged: UserPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(user?.preferences ?? {}),
  };

  const notifications = {
    emailCompetition: merged.emailCompetition,
    emailBreeding: merged.emailBreeding,
    emailSystem: merged.emailSystem,
    inAppTraining: merged.inAppTraining,
    inAppAchievements: merged.inAppAchievements,
    inAppNews: merged.inAppNews,
  };
  const display = {
    reducedMotion: merged.reducedMotion,
    highContrast: merged.highContrast,
    compactCards: merged.compactCards,
  };

  const persist = (updates: Partial<UserPreferences>) => {
    updatePreferences.mutate(updates, {
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Could not save your preference.';
        toast.error(`Couldn't save preference: ${msg}`);
      },
    });
  };

  const setNotif = (key: NotificationKey) => (val: boolean) => {
    persist({ [key]: val } as Partial<UserPreferences>);
  };

  const setDisp = (key: DisplayKey) => (val: boolean) => {
    persist({ [key]: val } as Partial<UserPreferences>);
  };

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
                    autoComplete="username"
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
                    autoComplete="email"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSaveAccount}
                  disabled={updateProfile.isPending}
                  className="px-4 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-celestial-gold text-sm font-medium hover:bg-celestial-gold/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="settings-save-account"
                >
                  {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-medium text-white/70 mb-3">Change Password</h3>

                {!showPasswordForm ? (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
                    data-testid="settings-show-password-form"
                  >
                    Update Password
                  </button>
                ) : (
                  <form
                    onSubmit={handleChangePassword}
                    className="space-y-3"
                    data-testid="settings-password-form"
                  >
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
                        autoComplete="current-password"
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="settings-new-password"
                        className="block text-xs font-medium text-white/60 mb-1"
                      >
                        New Password (min 8 characters)
                      </label>
                      <input
                        id="settings-new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        minLength={8}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
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
                        autoComplete="new-password"
                        minLength={8}
                        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={changePassword.isPending}
                        className="px-4 py-2 rounded-lg bg-celestial-gold/10 border border-celestial-gold/30 text-celestial-gold text-sm font-medium hover:bg-celestial-gold/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="settings-submit-password"
                      >
                        {changePassword.isPending ? 'Changing…' : 'Change Password'}
                      </button>
                      <button
                        type="button"
                        onClick={resetPasswordForm}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <div className="border-t border-red-900/30 pt-6">
                <h3 className="text-sm font-medium text-red-400 mb-1">Danger Zone</h3>
                <p className="text-xs text-white/40 mb-3">
                  Permanently delete your account and all data. This cannot be undone.
                </p>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
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
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Notification Preferences
              </h2>

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

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && user && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          data-testid="settings-delete-modal"
          // Equoria-ocn9 re-review fix: backdrop dismiss only fires when
          // BOTH mousedown and mouseup land on the backdrop itself. The
          // previous `onClick` alone would close the modal when a user
          // clicked-and-held on the warning text inside the panel and then
          // dragged the cursor onto the backdrop to release (the resulting
          // `click` event fires on the backdrop, the LCA of mousedown +
          // mouseup). That pattern is common during text selection while
          // reading the irreversible-action warning, and losing the modal
          // mid-read was confusing.
          onMouseDown={(e) => {
            backdropMouseDownRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (backdropMouseDownRef.current && e.target === e.currentTarget) {
              closeDeleteModal();
            }
            backdropMouseDownRef.current = false;
          }}
        >
          <div className="max-w-md w-full rounded-xl border border-red-500/30 bg-[var(--bg-night-sky)] p-6 space-y-4 shadow-2xl">
            <h3 id="delete-account-title" className="text-lg font-semibold text-red-400">
              Delete account permanently?
            </h3>
            <p className="text-sm text-white/70">
              This will permanently delete your account, all of your horses, breeding records,
              competition history, and inventory. <strong>This cannot be undone.</strong>
            </p>
            <p className="text-sm text-white/70">
              To confirm, type your username{' '}
              <code className="px-1 py-0.5 rounded bg-white/10 text-celestial-gold">
                {user.username}
              </code>{' '}
              below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
              // Equoria-ocn9 review fix: focus the confirm input on open so
              // keyboard users can start typing immediately. Without
              // autoFocus the focus stayed on the page-behind "Delete
              // Account" button.
              autoFocus
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-red-500/50"
              data-testid="settings-delete-confirm-input"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
                data-testid="settings-delete-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteAccount.isPending || deleteConfirmText.trim() !== user.username}
                className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="settings-delete-confirm"
              >
                {deleteAccount.isPending ? 'Deleting…' : 'Delete account permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
