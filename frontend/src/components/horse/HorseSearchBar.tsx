/**
 * HorseSearchBar Component
 *
 * Provides a search input for filtering horses by name, breed, and traits.
 *
 * Features:
 * - Debounced input (300ms delay) to reduce unnecessary updates
 * - Clear button that appears when text is present
 * - Search icon indicator on the left
 * - Keyboard support (Escape to clear, Enter to submit)
 * - Full accessibility with ARIA labels and roles
 * - Responsive design with proper focus states
 *
 * Story 3-6: Horse Search & Filter - Task 3
 */

import { Search, X } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';

export interface HorseSearchBarProps {
  /**
   * Current search value (controlled component)
   */
  value: string;

  /**
   * Callback when search value changes (debounced)
   */
  onChange: (value: string) => void;

  /**
   * Placeholder text for the input
   * @default "Search horses by name, breed, or traits..."
   */
  placeholder?: string;

  /**
   * Debounce delay in milliseconds
   * @default 300
   */
  debounceMs?: number;

  /**
   * Whether the search is currently loading/filtering
   * @default false
   */
  isLoading?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Callback when search is submitted (Enter key)
   */
  onSubmit?: () => void;

  /**
   * Whether to auto-focus on mount
   * @default false
   */
  autoFocus?: boolean;
}

/**
 * Debounced search bar for filtering horses
 */
const HorseSearchBar = ({
  value,
  onChange,
  placeholder = 'Search horses by name, breed, or traits...',
  debounceMs = 300,
  isLoading = false,
  className = '',
  onSubmit,
  autoFocus = false,
}: HorseSearchBarProps) => {
  const [localValue, setLocalValue] = useState(value);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value with prop value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce onChange callback
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, debounceMs);

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localValue, value, onChange, debounceMs]);

  /**
   * Handle input change
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  };

  /**
   * Clear search input
   */
  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  /**
   * Handle keyboard events
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClear();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Immediately call onChange to flush debounce
      if (localValue !== value) {
        onChange(localValue);
      }
      onSubmit?.();
    }
  };

  const hasValue = localValue.length > 0;

  return (
    <div className={`relative ${className}`}>
      <label htmlFor="horse-search-input" className="sr-only">
        Search horses
      </label>

      {/* Search Icon */}
      <div
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden="true"
      >
        <Search
          className={`w-5 h-5 transition-colors ${
            isLoading ? 'text-blue-500 animate-pulse' : hasValue ? 'text-gray-700' : 'text-gray-400'
          }`}
        />
      </div>

      {/* Search Input */}
      <input
        ref={inputRef}
        id="horse-search-input"
        type="text"
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={`
          w-full pl-11 pr-10 py-2.5
          border border-gray-300 rounded-lg
          text-gray-900 placeholder-gray-500
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          transition-all duration-200
          ${isLoading ? 'bg-blue-50' : 'bg-white'}
        `}
        aria-label="Search horses by name, breed, or traits"
        aria-describedby={hasValue ? 'search-clear-button' : undefined}
        disabled={isLoading}
      />

      {/* Clear Button */}
      {hasValue && (
        <button
          id="search-clear-button"
          type="button"
          onClick={handleClear}
          className={`
            absolute right-3 top-1/2 -translate-y-1/2
            p-1 rounded-full
            text-gray-400 hover:text-gray-600 hover:bg-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-all duration-200
          `}
          aria-label="Clear search"
          disabled={isLoading}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Loading Indicator (for screen readers) */}
      {isLoading && (
        <span className="sr-only" role="status" aria-live="polite">
          Searching...
        </span>
      )}
    </div>
  );
};

export default HorseSearchBar;
