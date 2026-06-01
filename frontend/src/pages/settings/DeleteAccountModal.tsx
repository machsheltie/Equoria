/**
 * DeleteAccountModal (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Typed-confirmation modal for irreversible account deletion. Preserves the
 * backdrop mousedown/mouseup dismiss guard (Equoria-ocn9), the autofocus on
 * the confirm input, and the trim()-based username match. All state and the
 * delete mutation live in the SettingsPage container.
 */

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';

export interface DeleteAccountModalProps {
  username: string;
  confirmText: string;
  onConfirmTextChange: (_value: string) => void;
  onClose: () => void;
  onConfirmDelete: () => void;
  isDeleting: boolean;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  username,
  confirmText,
  onConfirmTextChange,
  onClose,
  onConfirmDelete,
  isDeleting,
}) => {
  // Equoria-ocn9 re-review fix: track whether the mousedown that started a
  // potential backdrop click actually landed on the backdrop. Used by the
  // mouseup handler to skip drag-out cases (mousedown inside, mouseup outside).
  const backdropMouseDownRef = useRef(false);

  return (
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
          onClose();
        }
        backdropMouseDownRef.current = false;
      }}
    >
      <div className="max-w-md w-full glass-panel-heavy rounded-xl p-6 space-y-4 shadow-2xl border border-red-500/30">
        <h3 id="delete-account-title" className="text-lg font-semibold text-red-400">
          Delete account permanently?
        </h3>
        <p className="text-sm text-white/70">
          This will permanently delete your account, all of your horses, breeding records,
          competition history, and inventory. <strong>This cannot be undone.</strong>
        </p>
        <p className="text-sm text-white/70">
          To confirm, type your username{' '}
          <code className="px-1 py-0.5 rounded bg-white/10 text-celestial-gold">{username}</code>{' '}
          below:
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          autoComplete="off"
          // Equoria-ocn9 review fix: focus the confirm input on open so
          // keyboard users can start typing immediately.
          autoFocus
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-red-500/50"
          data-testid="settings-delete-confirm-input"
        />
        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            data-testid="settings-delete-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirmDelete}
            disabled={isDeleting || confirmText.trim() !== username}
            data-testid="settings-delete-confirm"
          >
            {isDeleting ? 'Deleting…' : 'Delete account permanently'}
          </Button>
        </div>
      </div>
    </div>
  );
};
