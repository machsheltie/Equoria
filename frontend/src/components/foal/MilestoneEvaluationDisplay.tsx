/**
 * MilestoneEvaluationDisplay Component
 *
 * Main component for displaying milestone evaluation results.
 * Shows evaluation modal, score breakdown, trait confirmation,
 * and evaluation history.
 *
 * Story 6-4: Milestone Evaluation Display
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, History, AlertCircle, Sparkles } from 'lucide-react';
import BaseModal from '@/components/common/BaseModal';
import EvaluationScoreDisplay from './EvaluationScoreDisplay';
import ScoreBreakdownPanel from './ScoreBreakdownPanel';
import TraitConfirmationCard from './TraitConfirmationCard';
import EvaluationHistoryItem from './EvaluationHistoryItem';
import EvaluationExplanation from './EvaluationExplanation';
import type {
  MilestoneType,
  MilestoneEvaluation,
  MilestoneEvaluationHistory,
  EpigeneticTrait,
} from '@/types/foal';
import { formatMilestoneName, getMilestoneDescription } from '@/types/foal';

export interface MilestoneEvaluationDisplayProps {
  foalId: number;
  milestoneType?: MilestoneType; // If showing specific evaluation
  showHistory?: boolean;
  autoShowLatest?: boolean; // Automatically show latest evaluation
}

/**
 * Mock API - Replace with actual API calls
 */
const mockApi = {
  getEvaluationHistory: async (_foalId: number): Promise<MilestoneEvaluationHistory> => {
    // Mock data - replace with actual API call
    return {
      evaluations: [
        {
          milestone: 'socialization',
          milestoneName: 'Socialization',
          score: 4,
          traitsConfirmed: ['peopleOriented'],
          evaluatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          bondModifier: 2,
          taskConsistency: 2,
          careQuality: 0,
          scoreBreakdown: {
            bondModifier: 2,
            taskConsistency: 2,
            careQuality: 0,
          },
        },
        {
          milestone: 'imprinting',
          milestoneName: 'Imprinting',
          score: 2,
          traitsConfirmed: ['confident'],
          evaluatedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          bondModifier: 1,
          taskConsistency: 1,
          careQuality: 0,
          scoreBreakdown: {
            bondModifier: 1,
            taskConsistency: 1,
            careQuality: 0,
          },
        },
      ],
      completedMilestones: ['imprinting', 'socialization'],
      currentMilestone: 'curiosity_play',
    };
  },

  getTraitDefinitions: async (): Promise<{ traits: EpigeneticTrait[] }> => {
    // Mock data - replace with actual API call
    return {
      traits: [
        {
          id: 'peopleOriented',
          name: 'People-Oriented',
          category: 'Social',
          description: 'Bonds quickly with handlers and seeks human interaction',
          effects: [
            {
              type: 'Training XP Gain',
              value: 15,
              description: '+15% XP gain from training sessions',
            },
            {
              type: 'Handler Bonding',
              value: 20,
              description: 'Bonds 20% faster with handlers',
            },
          ],
          isPositive: true,
        },
        {
          id: 'confident',
          name: 'Confident',
          category: 'Temperament',
          description: 'Shows self-assurance and boldness in new situations',
          effects: [
            {
              type: 'Stress Resistance',
              value: 10,
              description: '-10% stress from competitions',
            },
          ],
          isPositive: true,
        },
      ],
    };
  },
};

/**
 * MilestoneEvaluationDisplay Component
 */
const MilestoneEvaluationDisplay: React.FC<MilestoneEvaluationDisplayProps> = ({
  foalId,
  milestoneType: _milestoneType,
  showHistory = true,
  autoShowLatest = false,
}) => {
  const [selectedEvaluation, setSelectedEvaluation] = useState<MilestoneEvaluation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch evaluation history
  const {
    data: evaluationHistory,
    isLoading: historyLoading,
    error: historyError,
  } = useQuery({
    queryKey: ['milestone-evaluations', foalId],
    queryFn: () => mockApi.getEvaluationHistory(foalId),
    staleTime: 60000,
    refetchOnFocus: true,
  });

  // Fetch trait definitions
  const { data: traitData, isLoading: traitsLoading } = useQuery({
    queryKey: ['trait-definitions'],
    queryFn: mockApi.getTraitDefinitions,
    staleTime: 600000,
  });

  // Get latest evaluation
  const latestEvaluation = evaluationHistory?.evaluations?.[0];

  // Auto-show latest evaluation if enabled
  React.useEffect(() => {
    if (autoShowLatest && latestEvaluation && !isModalOpen) {
      setSelectedEvaluation(latestEvaluation);
      setIsModalOpen(true);
    }
  }, [autoShowLatest, latestEvaluation, isModalOpen]);

  // Get traits for selected evaluation
  const getTraitsForEvaluation = (evaluation: MilestoneEvaluation): EpigeneticTrait[] => {
    if (!traitData || !evaluation.traitsConfirmed) return [];
    return evaluation.traitsConfirmed
      .map((traitId) => traitData.traits.find((t) => t.id === traitId))
      .filter((t): t is EpigeneticTrait => t !== undefined);
  };

  const handleViewEvaluation = (evaluation: MilestoneEvaluation) => {
    setSelectedEvaluation(evaluation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Keep selectedEvaluation for potential reopening
  };

  if (historyLoading || traitsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (historyError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error loading evaluations</p>
            <p className="text-sm text-red-700 mt-1">
              {historyError instanceof Error ? historyError.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!evaluationHistory || evaluationHistory.evaluations.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <Award className="h-8 w-8 text-slate-400" />
        </div>
        <p className="text-slate-600 text-sm">No milestone evaluations yet</p>
        <p className="text-slate-500 text-xs mt-1">
          Evaluations will appear as your foal completes developmental milestones
        </p>
      </div>
    );
  }

  const traits = selectedEvaluation ? getTraitsForEvaluation(selectedEvaluation) : [];

  return (
    <div className="space-y-6">
      {/* Evaluation History */}
      {showHistory && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-900">Milestone Evaluation History</h3>
          </div>

          <div className="space-y-3">
            {evaluationHistory.evaluations.map((evaluation, index) => (
              <EvaluationHistoryItem
                key={`${evaluation.milestone}-${evaluation.evaluatedAt}`}
                evaluation={evaluation}
                onViewDetails={() => handleViewEvaluation(evaluation)}
                defaultExpanded={index === 0 && !autoShowLatest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Results Modal */}
      {selectedEvaluation && (
        <BaseModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title="Milestone Evaluation Results"
          size="xl"
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center pb-4 border-b border-slate-200">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
                <Sparkles className="h-8 w-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {selectedEvaluation.milestoneName ||
                  formatMilestoneName(selectedEvaluation.milestone)}{' '}
                Complete!
              </h2>
              <p className="text-sm text-slate-600">
                Completed:{' '}
                {new Date(selectedEvaluation.evaluatedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {getMilestoneDescription(selectedEvaluation.milestone)}
              </p>
            </div>

            {/* Overall Score */}
            <EvaluationScoreDisplay score={selectedEvaluation.score} size="large" />

            {/* Score Breakdown */}
            <ScoreBreakdownPanel
              bondModifier={selectedEvaluation.bondModifier}
              taskConsistency={selectedEvaluation.taskConsistency}
              careQuality={selectedEvaluation.careQuality}
              totalScore={selectedEvaluation.score}
            />

            {/* Traits Confirmed */}
            {traits.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Award className="h-5 w-5 text-emerald-600" />
                  Traits Confirmed
                </h3>
                {traits.map((trait) => (
                  <TraitConfirmationCard
                    key={trait.id}
                    trait={trait}
                    score={selectedEvaluation.score}
                    showReason
                  />
                ))}
              </div>
            )}

            {/* Explanation */}
            <EvaluationExplanation
              score={selectedEvaluation.score}
              milestone={selectedEvaluation.milestone}
              traits={selectedEvaluation.traitsConfirmed}
            />

            {/* Continue Button */}
            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={handleCloseModal}
                className="w-full px-4 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
};

export default MilestoneEvaluationDisplay;
