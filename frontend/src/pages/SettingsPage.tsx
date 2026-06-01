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
 * 4. Sound — sound-effects master toggle + previews
 *
 * Equoria-ocn9 (2026-04-23): Account section is no longer a façade.
 * - Inputs are controlled and seeded from useAuth().user.
 * - Save Changes calls useUpdateProfile() (PUT /api/v1/auth/profile).
 * - Update Password reveals an inline form and calls useChangePassword()
 *   (POST /api/v1/auth/change-password). On success the server invalidates all
 *   sessions; we sign the user out client-side to match.
 * - Delete Account opens a typed-confirmation modal and calls
 *   useDeleteAccount() (DELETE /api/users/:id). The hook clears React Query
 *   cache and redirects to /login on success.
 *
 * Equoria-qk3vi: decomposed under the 600-line cap. This file is now the
 * container — it owns ALL state, hooks, and mutation handlers and passes
 * them as props to presentational section components under `pages/settings/`
 * (AccountSection, NotificationsSection, DisplaySection, SoundSection,
 * DeleteAccountModal). Behavior is unchanged.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import PageHero from '@/components/layout/PageHero';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdatePreferences } from '@/hooks/api/useUpdatePreferences';
import { useUpdateProfile, useChangePassword, useDeleteAccount, useLogout } from '@/hooks/useAuth';
import { useSound } from '@/hooks/useSound';
import type { UserPreferences } from '@/lib/api-client';
import {
  sections,
  DEFAULT_PREFERENCES,
  type NotificationKey,
  type DisplayKey,
} from './settings/constants';
import { AccountSection } from './settings/AccountSection';
import { NotificationsSection } from './settings/NotificationsSection';
import { DisplaySection } from './settings/DisplaySection';
import { SoundSection } from './settings/SoundSection';
import { DeleteAccountModal } from './settings/DeleteAccountModal';

const SettingsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('account');

  const { user } = useAuth();
  const updatePreferences = useUpdatePreferences();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const deleteAccount = useDeleteAccount();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { soundEnabled, setSoundEnabled, playSound } = useSound();

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
          // Code-review chunk-A fix: cross-tab cache invalidation. The server
          // invalidates all sessions on password change, but other tabs in
          // this browser still hold cached identity / horse / balance data
          // in React Query until their next request 401s — a brief window
          // where stale PII is readable. Synchronously clear the cache and
          // dispatch a storage event so siblings detect the password change
          // immediately via window.addEventListener('storage', …).
          queryClient.clear();
          try {
            // setItem-then-removeItem fires a storage event in OTHER tabs
            // (the originating tab gets nothing). The flag value is
            // deliberately a timestamp so identical replays still trigger
            // the storage handler.
            const flagKey = 'equoria:forceLogoutAt';
            localStorage.setItem(flagKey, String(Date.now()));
            localStorage.removeItem(flagKey);
          } catch {
            // localStorage may be unavailable (quota / private mode); cache
            // clear above is the primary defense, the storage event is a
            // secondary nicety.
          }
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
      onSuccess: () => {
        // Code-review chunk-A fix: explicitly close the modal on success
        // BEFORE the hook's redirect kicks in. Without this, the modal
        // stays mounted during the unmount race and the Confirm button
        // can re-fire the mutation if the user double-clicks. The hook
        // also clears cache and redirects, but those are unmount-side;
        // closing the modal is a render-side concern.
        closeDeleteModal();
      },
      onError: (err) => {
        // Code-review chunk-A fix: detect CSRF/expiry-class failures and
        // surface a recovery path. A long-idle session whose CSRF token
        // rotated out from under the modal would otherwise loop forever
        // — every retry returns 403 with no UI escape hatch except a
        // hard reload. Right-to-delete (GDPR) must remain reachable.
        //
        // ApiError shape (frontend/src/lib/api-client.ts): { statusCode:number,
        // status:string, message:string, retryAfter?:number }. We read
        // `statusCode` (HTTP code) — `status` is the JSON-API status string
        // (e.g. "error"), not the HTTP status.
        const statusCode = (err as unknown as { statusCode?: number })?.statusCode;
        const message = err?.message ?? '';
        const isCsrfClass =
          statusCode === 403 || /csrf/i.test(message) || /forbidden/i.test(message);
        if (isCsrfClass) {
          toast.error(
            'Your session expired before this action could complete. Please reload the page and try again.'
          );
          // Close the modal so the user can recover; the typed
          // confirmation is lost intentionally — they will type it again
          // after a fresh session, which is consistent with the
          // typed-confirmation security gesture.
          closeDeleteModal();
          return;
        }
        toast.error(message || 'Could not delete account.');
      },
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

  // Sync server soundEnabled to localStorage on first load so the hook
  // and other in-memory consumers see the authoritative server value.
  const serverSoundEnabled = user?.preferences?.soundEnabled;
  const setSoundEnabledRef = setSoundEnabled;
  useEffect(() => {
    if (typeof serverSoundEnabled === 'boolean') {
      setSoundEnabledRef(serverSoundEnabled);
    }
  }, [serverSoundEnabled, setSoundEnabledRef]);

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
          {activeSection === 'account' && (
            <AccountSection
              username={username}
              email={email}
              onUsernameChange={setUsername}
              onEmailChange={setEmail}
              onSaveAccount={handleSaveAccount}
              isSavingAccount={updateProfile.isPending}
              showPasswordForm={showPasswordForm}
              onShowPasswordForm={() => setShowPasswordForm(true)}
              oldPassword={oldPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              onOldPasswordChange={setOldPassword}
              onNewPasswordChange={setNewPassword}
              onConfirmPasswordChange={setConfirmPassword}
              onChangePassword={handleChangePassword}
              onResetPasswordForm={resetPasswordForm}
              isChangingPassword={changePassword.isPending}
              onOpenDeleteModal={() => setShowDeleteModal(true)}
            />
          )}

          {activeSection === 'notifications' && (
            <NotificationsSection notifications={notifications} setNotif={setNotif} />
          )}

          {activeSection === 'display' && <DisplaySection display={display} setDisp={setDisp} />}

          {activeSection === 'sound' && (
            <SoundSection
              soundChecked={merged.soundEnabled ?? soundEnabled}
              soundEnabled={soundEnabled}
              onToggleSound={(val) => {
                setSoundEnabled(val);
                persist({ soundEnabled: val });
                // Play a sample click so the user hears the change take effect
                if (val) {
                  playSound('click');
                }
              }}
              playSound={playSound}
            />
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && user && (
        <DeleteAccountModal
          username={user.username}
          confirmText={deleteConfirmText}
          onConfirmTextChange={setDeleteConfirmText}
          onClose={closeDeleteModal}
          onConfirmDelete={handleConfirmDelete}
          isDeleting={deleteAccount.isPending}
        />
      )}
    </div>
  );
};

export default SettingsPage;
