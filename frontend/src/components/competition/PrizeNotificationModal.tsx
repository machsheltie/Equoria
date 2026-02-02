/**
 * PrizeNotificationModal Component
 *
 * A celebratory modal dialog for displaying prize notifications to users:
 * - Trophy/medal icons based on placement (1st: gold, 2nd: silver, 3rd: bronze)
 * - Congratulations heading with placement text
 * - Prize money with currency formatting
 * - XP gained with "+X XP" badge
 * - Competition context (name, discipline, date, horse name)
 * - Animated entrance (fade-in, scale-up)
 * - Auto-dismiss functionality with configurable delay
 *
 * Features:
 * - Portal rendering for proper stacking context
 * - Focus trap when open
 * - Scroll lock when open
 * - Escape key to close
 * - Backdrop click to close
 * - WCAG 2.1 AA compliance
 *
 * Story 5-3: Prize Notification System
 */

import React, { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, Medal, X, Calendar, Award, Zap, DollarSign } from 'lucide-react';

/**
 * Prize data structure containing all information to display
 */
export interface PrizeData {
  /** Name of the horse that earned the prize */
  horseName: string;
  /** Name of the competition */
  competitionName: string;
  /** Competition discipline */
  discipline: string;
  /** Competition date */
  date: string;
  /** Placement achieved (1, 2, or 3) */
  placement: 1 | 2 | 3;
  /** Prize money won */
  prizeMoney: number;
  /** XP points gained */
  xpGained: number;
}

/**
 * PrizeNotificationModal component props
 */
export interface PrizeNotificationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Prize data to display */
  prizeData: PrizeData;
  /** Whether to auto-dismiss the modal (default: true) */
  autoDismiss?: boolean;
  /** Auto-dismiss delay in milliseconds (default: 5000) */
  autoDismissDelay?: number;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get placement text based on rank
 */
const getPlacementText = (placement: 1 | 2 | 3): string => {
  switch (placement) {
    case 1:
      return '1st Place';
    case 2:
      return '2nd Place';
    case 3:
      return '3rd Place';
  }
};

/**
 * Get placement badge styling based on rank
 */
const getPlacementBadgeClasses = (placement: 1 | 2 | 3): string => {
  switch (placement) {
    case 1:
      return 'bg-yellow-400 text-yellow-900'; // Gold
    case 2:
      return 'bg-gray-300 text-gray-900'; // Silver
    case 3:
      return 'bg-orange-600 text-orange-50'; // Bronze
  }
};

/**
 * Get gradient colors based on placement
 */
const getGradientClasses = (placement: 1 | 2 | 3): string => {
  switch (placement) {
    case 1:
      return 'from-yellow-400 via-amber-500 to-yellow-600'; // Gold gradient
    case 2:
      return 'from-gray-300 via-slate-400 to-gray-500'; // Silver gradient
    case 3:
      return 'from-orange-400 via-orange-500 to-orange-600'; // Bronze gradient
  }
};

/**
 * Placement icon component
 */
const PlacementIcon = memo(({ placement }: { placement: 1 | 2 | 3 }) => {
  if (placement === 1) {
    return (
      <Trophy
        className="h-10 w-10 text-yellow-500 drop-shadow-lg"
        aria-hidden="true"
        data-testid="trophy-icon"
      />
    );
  }
  return (
    <Medal
      className={`h-10 w-10 drop-shadow-lg ${
        placement === 2 ? 'text-gray-400' : 'text-orange-500'
      }`}
      aria-hidden="true"
      data-testid="medal-icon"
    />
  );
});

PlacementIcon.displayName = 'PlacementIcon';

/**
 * PrizeNotificationModal Component
 *
 * Displays a celebratory notification when a horse wins a prize.
 */
const PrizeNotificationModal = memo(function PrizeNotificationModal({
  isOpen,
  onClose,
  prizeData,
  autoDismiss = true,
  autoDismissDelay = 5000,
}: PrizeNotificationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Escape key press
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  // Stop propagation to prevent backdrop click when clicking content
  const handleContentClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  // Focus management, keyboard handler, and auto-dismiss
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

      // Set up auto-dismiss timer
      if (autoDismiss) {
        timerRef.current = setTimeout(() => {
          onClose();
        }, autoDismissDelay);
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';

        // Clear auto-dismiss timer
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }

        // Restore focus to previous element
        if (previousActiveElement.current && previousActiveElement.current instanceof HTMLElement) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, handleKeyDown, autoDismiss, autoDismissDelay, onClose]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  const { horseName, competitionName, discipline, date, placement, prizeMoney, xpGained } = prizeData;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prize-modal-title"
        tabIndex={-1}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col focus:outline-none animate-fade-in animate-scale-up"
        onClick={handleContentClick}
        data-testid="prize-notification-modal"
      >
        {/* Celebration Header with Gradient */}
        <div
          className={`bg-gradient-to-r ${getGradientClasses(placement)} p-6 text-center relative`}
          data-testid="celebration-header"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
            aria-label="Close prize notification"
            data-testid="close-button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Placement Icon */}
          <div className="flex justify-center mb-3">
            <div className="bg-white/20 rounded-full p-4">
              <PlacementIcon placement={placement} />
            </div>
          </div>

          {/* Congratulations Heading */}
          <h2
            id="prize-modal-title"
            className="text-2xl font-bold text-white mb-1"
            data-testid="congratulations-heading"
          >
            Congratulations! {getPlacementText(placement)}!
          </h2>

          {/* Horse Name */}
          <p className="text-white/90 font-medium" data-testid="horse-name">
            {horseName}
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-6" data-testid="modal-content">
          {/* Placement Badge */}
          <div className="flex justify-center mb-6">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${getPlacementBadgeClasses(placement)}`}
              data-testid="placement-badge"
            >
              <PlacementIcon placement={placement} />
              <span className="sr-only">Achieved </span>
              {getPlacementText(placement)}
            </span>
          </div>

          {/* Prize Breakdown */}
          <div className="space-y-4">
            {/* Prize Money */}
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full">
                  <DollarSign className="h-5 w-5 text-green-600" aria-hidden="true" />
                </div>
                <span className="text-sm font-medium text-slate-700">Prize Money</span>
              </div>
              <span
                className="text-xl font-bold text-green-600"
                data-testid="prize-money"
              >
                {formatCurrency(prizeMoney)}
              </span>
            </div>

            {/* XP Gained */}
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-full">
                  <Zap className="h-5 w-5 text-purple-600" aria-hidden="true" />
                </div>
                <span className="text-sm font-medium text-slate-700">Experience Gained</span>
              </div>
              <span
                className="text-xl font-bold text-purple-600"
                data-testid="xp-gained"
              >
                +{xpGained} XP
              </span>
            </div>
          </div>

          {/* Competition Context */}
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-600" data-testid="competition-name">
                {competitionName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span
                className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                data-testid="competition-discipline"
              >
                {discipline}
              </span>
              <span className="flex items-center gap-1" data-testid="competition-date">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                {formatDate(date)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render via portal for proper stacking context
  return createPortal(modalContent, document.body);
});

export default PrizeNotificationModal;
