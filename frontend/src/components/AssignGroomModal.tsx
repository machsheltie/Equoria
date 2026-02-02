/**
 * AssignGroomModal Component
 *
 * Modal for assigning a groom to a horse with the following features:
 * - Display horse information
 * - List available grooms with slot availability
 * - Allow groom selection with radio buttons
 * - Configure assignment priority (1-5)
 * - Add optional notes (max 500 characters)
 * - Replace primary assignment option (when priority=1)
 * - Validate assignment before submission
 * - Handle success/error states
 * - Accessibility support with ARIA labels and keyboard navigation
 *
 * Uses React Query for API integration with groom assignment endpoints
 */

import React, { useState, useEffect } from 'react';
import { X, User, Star, AlertCircle, CheckCircle } from 'lucide-react';
import { useAssignGroom } from '../hooks/api/useGrooms';

// Type definitions
interface Groom {
  id: number;
  name: string;
  skillLevel: string;
  specialty: string;
  personality: string;
  experience: number;
  sessionRate: number;
  isActive: boolean;
  availableSlots: number;
  currentAssignments: number;
  maxAssignments: number;
}

interface AssignGroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  horseId: number;
  horseName: string;
  userId: number;
  onAssignmentComplete?: (assignment: any) => void;
  availableGrooms?: Groom[];
}

const AssignGroomModal: React.FC<AssignGroomModalProps> = ({
  isOpen,
  onClose,
  horseId,
  horseName,
  userId,
  onAssignmentComplete,
  availableGrooms = [],
}) => {
  // State management
  const [selectedGroomId, setSelectedGroomId] = useState<number | null>(null);
  const [priority, setPriority] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [replacePrimary, setReplacePrimary] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedGroomId(null);
      setPriority(1);
      setNotes('');
      setReplacePrimary(false);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Assignment mutation using centralized hook
  const assignMutation = useAssignGroom();

  // Custom success handler
  const handleMutationSuccess = () => {
    setSuccess(true);
    setError(null);

    if (onAssignmentComplete) {
      onAssignmentComplete({}); // Note: centralized hook doesn't return data
    }

    // Close modal after short delay to show success message
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  // Custom error handler
  const handleMutationError = (err: Error) => {
    setError(err.message);
    setSuccess(false);
  };

  // Handle assignment submission
  const handleAssign = () => {
    if (!selectedGroomId) {
      setError('Please select a groom');
      return;
    }

    setError(null);
    assignMutation.mutate(
      {
        groomId: selectedGroomId,
        horseId,
        priority,
        notes: notes.trim() || undefined,
        replacePrimary: priority === 1 ? replacePrimary : undefined,
      },
      {
        onSuccess: handleMutationSuccess,
        onError: handleMutationError,
      }
    );
  };

  // Get selected groom details
  const selectedGroom = availableGrooms.find((g) => g.id === selectedGroomId);

  // Format specialty for display
  const formatSpecialty = (specialty: string): string => {
    return specialty.replace(/([A-Z])/g, ' $1').trim();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      data-testid="assign-groom-modal"
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Assign groom to horse"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Assign Groom</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Horse Information */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Horse</h3>
            <p className="text-gray-700">{horseName}</p>
          </div>

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center">
              <CheckCircle className="text-green-600 mr-3" size={20} />
              <p className="text-green-800">Groom assigned successfully!</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center">
              <AlertCircle className="text-red-600 mr-3" size={20} />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Available Grooms */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Groom</h3>

            {availableGrooms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <User size={48} className="mx-auto mb-4 text-gray-400" />
                <p className="text-lg">No grooms available</p>
                <p className="text-sm mt-2">
                  Hire grooms from the marketplace to assign them to your horses.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableGrooms.map((groom) => (
                  <label
                    key={groom.id}
                    className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedGroomId === groom.id
                        ? 'border-blue-500 bg-blue-50'
                        : groom.availableSlots === 0
                          ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                          : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start">
                      <input
                        type="radio"
                        name="groom"
                        value={groom.id}
                        checked={selectedGroomId === groom.id}
                        onChange={() => setSelectedGroomId(groom.id)}
                        disabled={groom.availableSlots === 0}
                        className="mt-1 mr-3"
                        aria-label={`${groom.name} - ${groom.skillLevel} - ${groom.availableSlots} ${groom.availableSlots === 1 ? 'slot' : 'slots'} available`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{groom.name}</h4>
                          <span className="text-sm text-gray-600 capitalize">
                            {groom.skillLevel}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Specialty:</span>{' '}
                            <span className="capitalize">{formatSpecialty(groom.specialty)}</span>
                          </p>
                          <p>
                            <span className="font-medium">Experience:</span> {groom.experience}{' '}
                            years
                          </p>
                          <p>
                            <span className="font-medium">Slots:</span>{' '}
                            <span
                              className={
                                groom.availableSlots === 0
                                  ? 'text-red-600 font-semibold'
                                  : 'text-green-600 font-semibold'
                              }
                            >
                              {groom.availableSlots} {groom.availableSlots === 1 ? 'slot' : 'slots'}{' '}
                              available
                            </span>{' '}
                            ({groom.currentAssignments}/{groom.maxAssignments} assigned)
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Options */}
          {selectedGroom && (
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Assignment Options</h3>

              {/* Priority Selection */}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                  Priority Level
                </label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Priority level"
                >
                  <option value={1}>1 - Primary (Highest)</option>
                  <option value={2}>2 - High</option>
                  <option value={3}>3 - Medium</option>
                  <option value={4}>4 - Low</option>
                  <option value={5}>5 - Lowest</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Priority 1 assignments receive the most attention from the groom
                </p>
              </div>

              {/* Replace Primary Checkbox */}
              {priority === 1 && (
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    id="replacePrimary"
                    checked={replacePrimary}
                    onChange={(e) => setReplacePrimary(e.target.checked)}
                    className="mt-1 mr-3"
                  />
                  <label htmlFor="replacePrimary" className="text-sm text-gray-700">
                    <span className="font-medium">Replace existing primary assignment</span>
                    <p className="text-xs text-gray-500 mt-1">
                      If this horse already has a primary groom, deactivate that assignment
                    </p>
                  </label>
                </div>
              )}

              {/* Notes Input */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any special instructions or notes for this assignment..."
                  aria-label="Assignment notes"
                />
                <p className="text-xs text-gray-500 mt-1">{notes.length}/500 characters</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedGroomId || assignMutation.isPending || success}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Assign groom"
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign Groom'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignGroomModal;
