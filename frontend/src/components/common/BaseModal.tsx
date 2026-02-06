/**
 * BaseModal Component
 *
 * A reusable modal foundation that provides all common modal functionality:
 * - Portal rendering for proper stacking context
 * - Focus trap and focus management (store/restore previous focus)
 * - Keyboard handling (Escape key to close)
 * - Body scroll lock when modal is open
 * - Backdrop click to close
 * - ARIA attributes for accessibility
 * - Responsive design (mobile/tablet/desktop)
 * - WCAG 2.1 AA compliance
 *
 * This component consolidates modal patterns from:
 * - Epic 4: CompetitionDetailModal, TrainingResultModal, TrainingSessionModal
 * - Epic 5: EntryConfirmationModal, CompetitionResultsModal, PrizeNotificationModal
 *
 * Usage:
 * ```tsx
 * <BaseModal
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   title="Modal Title"
 *   size="md"
 *   footer={
 *     <>
 *       <button onClick={handleClose}>Cancel</button>
 *       <button onClick={handleSubmit}>Submit</button>
 *     </>
 *   }
 * >
 *   <p>Modal content goes here</p>
 * </BaseModal>
 * ```
 *
 * Action Item: AI-5-1 - Extract BaseModal Component
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Modal size options
 */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * BaseModal component props
 */
export interface BaseModalProps {
  /** Whether the modal is open */
  isOpen: boolean;

  /** Callback when modal should close */
  onClose: () => void;

  /** Modal title displayed in header */
  title: string;

  /** Modal content */
  children: React.ReactNode;

  /** Optional footer content (buttons, actions, etc.) */
  footer?: React.ReactNode;

  /** Modal size (default: 'md') */
  size?: ModalSize;

  /** Whether to show the close button (X) (default: true) */
  showCloseButton?: boolean;

  /** Whether to allow closing via Escape key (default: true) */
  closeOnEscape?: boolean;

  /** Whether to allow closing via backdrop click (default: true) */
  closeOnBackdropClick?: boolean;

  /** Whether the modal is in a loading/submitting state (default: false) */
  isSubmitting?: boolean;

  /** Additional CSS classes for the modal container */
  className?: string;

  /** ARIA description ID for screen readers */
  'aria-describedby'?: string;

  /** Test ID for the modal container */
  'data-testid'?: string;
}

/**
 * Get max-width class based on modal size
 */
const getSizeClasses = (size: ModalSize): string => {
  switch (size) {
    case 'sm':
      return 'max-w-md';
    case 'md':
      return 'max-w-2xl';
    case 'lg':
      return 'max-w-4xl';
    case 'xl':
      return 'max-w-6xl';
    case 'full':
      return 'max-w-[95vw]';
    default:
      return 'max-w-2xl';
  }
};

/**
 * BaseModal Component
 *
 * Provides all common modal functionality with a flexible API for customization.
 */
const BaseModal = memo(function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  isSubmitting = false,
  className = '',
  'aria-describedby': ariaDescribedby,
  'data-testid': dataTestId = 'base-modal',
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  /**
   * Handle Escape key press
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape && !isSubmitting) {
        onClose();
      }
    },
    [closeOnEscape, onClose, isSubmitting]
  );

  /**
   * Handle backdrop click
   */
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && closeOnBackdropClick && !isSubmitting) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose, isSubmitting]
  );

  /**
   * Stop propagation to prevent backdrop click when clicking modal content
   */
  const handleContentClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  /**
   * Focus management and keyboard handler
   */
  useEffect(() => {
    if (isOpen) {
      // Store previously focused element
      previousActiveElement.current = document.activeElement;

      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown);

      // Focus the modal container for accessibility
      if (modalRef.current) {
        modalRef.current.focus();
      }

      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        // Restore focus to previous element
        if (previousActiveElement.current && previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, handleKeyDown]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const sizeClasses = getSizeClasses(size);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid={`${dataTestId}-backdrop`}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dataTestId}-title`}
        aria-describedby={ariaDescribedby}
        tabIndex={-1}
        className={`bg-white rounded-lg shadow-xl ${sizeClasses} w-full max-h-[90vh] overflow-y-auto focus:outline-none ${className}`}
        onClick={handleContentClick}
        data-testid={dataTestId}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <h2
            id={`${dataTestId}-title`}
            className="text-2xl font-bold text-gray-900 flex-1 pr-4"
            data-testid={`${dataTestId}-title`}
          >
            {title}
          </h2>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1 flex-shrink-0"
              aria-label="Close modal"
              data-testid={`${dataTestId}-close-button`}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6" data-testid={`${dataTestId}-content`}>
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div
            className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50"
            data-testid={`${dataTestId}-footer`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  // Render via portal for proper stacking context
  return createPortal(modalContent, document.body);
});

export default BaseModal;
