/**
 * AccountSection (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Presentational Account-settings panel: username/email form, inline
 * change-password form, and the Danger-Zone delete trigger. All state and
 * mutation handlers live in the SettingsPage container and are passed in as
 * props, so behavior is identical to the pre-split inline block.
 */

import React from 'react';
import { Button } from '@/components/ui/button';

export interface AccountSectionProps {
  username: string;
  email: string;
  onUsernameChange: (_value: string) => void;
  onEmailChange: (_value: string) => void;
  onSaveAccount: () => void;
  isSavingAccount: boolean;

  showPasswordForm: boolean;
  onShowPasswordForm: () => void;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  onOldPasswordChange: (_value: string) => void;
  onNewPasswordChange: (_value: string) => void;
  onConfirmPasswordChange: (_value: string) => void;
  onChangePassword: (_e: React.FormEvent) => void;
  onResetPasswordForm: () => void;
  isChangingPassword: boolean;

  onOpenDeleteModal: () => void;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  username,
  email,
  onUsernameChange,
  onEmailChange,
  onSaveAccount,
  isSavingAccount,
  showPasswordForm,
  onShowPasswordForm,
  oldPassword,
  newPassword,
  confirmPassword,
  onOldPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onChangePassword,
  onResetPasswordForm,
  isChangingPassword,
  onOpenDeleteModal,
}) => (
  <div className="glass-panel space-y-6" data-testid="settings-account">
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
          onChange={(e) => onUsernameChange(e.target.value)}
          autoComplete="username"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
        />
      </div>

      <div>
        <label htmlFor="settings-email" className="block text-sm font-medium text-white/70 mb-1.5">
          Email
        </label>
        <input
          id="settings-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          autoComplete="email"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
        />
      </div>

      <Button
        type="button"
        onClick={onSaveAccount}
        disabled={isSavingAccount}
        data-testid="settings-save-account"
      >
        {isSavingAccount ? 'Saving…' : 'Save Changes'}
      </Button>
    </div>

    <div className="border-t border-white/10 pt-6">
      <h3 className="text-sm font-medium text-white/70 mb-3">Change Password</h3>

      {!showPasswordForm ? (
        <Button
          type="button"
          onClick={onShowPasswordForm}
          data-testid="settings-show-password-form"
        >
          Update Password
        </Button>
      ) : (
        <form
          onSubmit={onChangePassword}
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
              onChange={(e) => onOldPasswordChange(e.target.value)}
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
              onChange={(e) => onNewPasswordChange(e.target.value)}
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
              onChange={(e) => onConfirmPasswordChange(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-celestial-gold/50"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={isChangingPassword}
              data-testid="settings-submit-password"
            >
              {isChangingPassword ? 'Changing…' : 'Change Password'}
            </Button>
            <Button type="button" variant="secondary" onClick={onResetPasswordForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>

    <div className="border-t border-red-900/30 pt-6">
      <h3 className="text-sm font-medium text-red-400 mb-1">Danger Zone</h3>
      <p className="text-xs text-white/40 mb-3">
        Permanently delete your account and all data. This cannot be undone.
      </p>
      <Button type="button" onClick={onOpenDeleteModal} data-testid="settings-delete-account">
        Delete Account
      </Button>
    </div>
  </div>
);
