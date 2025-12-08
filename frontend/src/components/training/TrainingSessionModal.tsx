import type { TrainableHorse } from '@/lib/api-client';

interface TrainingSessionModalProps {
  horse: TrainableHorse;
  onClose: () => void;
  onCompleted: () => void;
}

/**
 * Modal for training session management
 * TODO: Implement full training session functionality
 */
const TrainingSessionModal = ({ horse, onClose, onCompleted }: TrainingSessionModalProps) => {
  if (!horse) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Training Session: {horse.name}</h2>
        <p className="text-gray-600 mb-4">Training functionality coming soon...</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default TrainingSessionModal;
