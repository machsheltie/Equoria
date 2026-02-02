/**
 * Quick Train Button Component
 *
 * Floating action button for quick training multiple horses
 *
 * Story 4.5: Training Dashboard - Task 6
 */

import { Zap, Loader2 } from 'lucide-react';

export interface QuickTrainButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const QuickTrainButton = ({
  onClick,
  disabled = false,
  loading = false,
  className = '',
}: QuickTrainButtonProps) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center gap-2 px-6 py-3
        bg-blue-600 text-white rounded-lg shadow-lg
        hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `.trim()}
      data-testid="quick-train-button"
      aria-label="Quick train available horses"
      aria-busy={loading}
    >
      {loading ? (
        <>
          <Loader2
            className="h-5 w-5 animate-spin"
            aria-hidden="true"
            data-testid="loading-spinner"
          />
          <span className="font-medium">Training...</span>
        </>
      ) : (
        <>
          <Zap className="h-5 w-5" aria-hidden="true" />
          <span className="font-medium">Quick Train</span>
        </>
      )}
    </button>
  );
};

export default QuickTrainButton;
