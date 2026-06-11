/**
 * AccountSection (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Presentational Account-settings panel: username/email form, inline
 * change-password form, and the Danger-Zone delete trigger. All state and
 * mutation handlers live in the SettingsPage container and are passed in as
 * props, so behavior is identical to the pre-split inline block.
 *
 * Design-system migration (Equoria-o5hub.22):
 * - Panel: Surface variant="panel" (was raw .glass-panel div).
 * - Fields: canonical Input/PasswordInput + FormField (was hand-rolled
 *   inputs with raw white/NN palette classes).
 * - Action hierarchy (DECISIONS.md §5): ONE gold primary per surface —
 *   "Save Changes". Password reveal/submit are secondary, password Cancel
 *   is outline, and "Delete Account" uses the destructive variant (never
 *   gold for destructive actions).
 * - Headings: type-section-heading for the panel h2; type-label for
 *   subsection h3s; dividers use --glass-border / --role-danger-border.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/Surface';
import { Input, PasswordInput, FormField } from '@/components/ui/form';

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
  <Surface variant="panel" className="space-y-6" data-testid="settings-account">
    <h2 className="type-section-heading">Account Settings</h2>

    <div className="space-y-4">
      <FormField label="Username" htmlFor="settings-username">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="text"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            autoComplete="username"
          />
        )}
      </FormField>

      <FormField label="Email" htmlFor="settings-email">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            autoComplete="email"
          />
        )}
      </FormField>

      <Button
        type="button"
        onClick={onSaveAccount}
        pending={isSavingAccount}
        data-testid="settings-save-account"
      >
        Save Changes
      </Button>
    </div>

    <div className="border-t border-[var(--glass-border)] pt-6">
      <h3 className="type-label mb-3">Change Password</h3>

      {!showPasswordForm ? (
        <Button
          type="button"
          variant="secondary"
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
          <FormField label="Current Password" htmlFor="settings-old-password">
            {(fieldProps) => (
              <PasswordInput
                {...fieldProps}
                value={oldPassword}
                onChange={(e) => onOldPasswordChange(e.target.value)}
                autoComplete="current-password"
              />
            )}
          </FormField>

          <FormField label="New Password (min 8 characters)" htmlFor="settings-new-password">
            {(fieldProps) => (
              <PasswordInput
                {...fieldProps}
                value={newPassword}
                onChange={(e) => onNewPasswordChange(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            )}
          </FormField>

          <FormField label="Confirm New Password" htmlFor="settings-confirm-password">
            {(fieldProps) => (
              <PasswordInput
                {...fieldProps}
                value={confirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            )}
          </FormField>

          {/* Action placement aligned with the Profile edit form: dismissive
              action first, affirmative action last (closure gate §13.8). */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onResetPasswordForm}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              pending={isChangingPassword}
              data-testid="settings-submit-password"
            >
              Change Password
            </Button>
          </div>
        </form>
      )}
    </div>

    <div className="border-t border-[var(--role-danger-border)] pt-6">
      <h3 className="type-label text-[var(--status-danger)] mb-1">Danger Zone</h3>
      <p className="text-xs text-role-muted mb-3">
        Permanently delete your account and all data. This cannot be undone.
      </p>
      <Button
        type="button"
        variant="destructive"
        onClick={onOpenDeleteModal}
        data-testid="settings-delete-account"
      >
        Delete Account
      </Button>
    </div>
  </Surface>
);
