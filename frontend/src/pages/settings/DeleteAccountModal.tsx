/**
 * DeleteAccountModal (extracted from SettingsPage — Equoria-qk3vi)
 *
 * Typed-confirmation dialog for irreversible account deletion. All state and
 * the delete mutation live in the SettingsPage container.
 *
 * Design-system migration (Equoria-o5hub.22 / DECISIONS.md §8):
 * - Built on the canonical GameDialog (Radix) — focus trap, Escape close,
 *   scroll lock, and focus restoration come from Radix; the page-local
 *   fixed-inset overlay, manual Escape handler, and the backdrop
 *   mousedown/mouseup drag-out guard (Equoria-ocn9) are all superseded:
 *   Radix dismisses on pointer-down *outside*, so a click-and-hold that
 *   starts inside the panel and releases on the backdrop does NOT close
 *   the dialog — same protection, owned by the primitive.
 * - Initial focus goes to the confirm input (onOpenAutoFocus), preserving
 *   the original autoFocus behavior for keyboard users.
 * - Pending-close: while the delete mutation is in flight, Escape /
 *   outside-click / Cancel cannot dismiss the dialog, and the confirm
 *   button shows the canonical pending spinner.
 * - Destructive treatment: confirm uses Button variant="destructive" —
 *   never the gold primary (DECISIONS.md §5).
 */

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import {
  GameDialog,
  GameDialogContent,
  GameDialogHeader,
  GameDialogTitle,
  GameDialogDescription,
  GameDialogFooter,
} from '@/components/ui/game';

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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <GameDialog
      open
      onOpenChange={(open) => {
        // Block dismissal while the delete mutation is pending so the
        // typed-confirmation UI cannot vanish mid-flight.
        if (!open && !isDeleting) onClose();
      }}
    >
      <GameDialogContent
        size="sm"
        className="border-[var(--role-danger-border)]"
        data-testid="settings-delete-modal"
        onOpenAutoFocus={(e) => {
          // Focus the confirm input on open so keyboard users can start
          // typing immediately (Equoria-ocn9 review fix, preserved).
          e.preventDefault();
          inputRef.current?.focus();
        }}
        onEscapeKeyDown={(e) => {
          if (isDeleting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isDeleting) e.preventDefault();
        }}
      >
        <GameDialogHeader className="border-[var(--role-danger-border)]">
          {/* Radix wires aria-labelledby/aria-describedby to Title/Description
              automatically — no manual id plumbing needed. */}
          <GameDialogTitle className="text-[var(--status-danger)]">
            Delete account permanently?
          </GameDialogTitle>
          <GameDialogDescription className="text-role-secondary">
            This will permanently delete your account, all of your horses, breeding records,
            competition history, and inventory. <strong>This cannot be undone.</strong>
          </GameDialogDescription>
        </GameDialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-role-secondary break-words">
            To confirm, type your username{' '}
            <code className="px-1 py-0.5 rounded-[var(--radius-sm)] bg-[var(--glass-bg)] text-role-link break-all">
              {username}
            </code>{' '}
            below:
          </p>
          <Input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            autoComplete="off"
            aria-label="Type your username to confirm deletion"
            data-testid="settings-delete-confirm-input"
          />
        </div>

        <GameDialogFooter className="border-[var(--role-danger-border)] sm:space-x-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="settings-delete-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirmDelete}
            pending={isDeleting}
            disabled={confirmText.trim() !== username}
            data-testid="settings-delete-confirm"
          >
            Delete account permanently
          </Button>
        </GameDialogFooter>
      </GameDialogContent>
    </GameDialog>
  );
};
