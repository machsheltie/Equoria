/**
 * MilestoneEvaluationDisplay Component
 *
 * Displays foal development progress using real API data.
 * Detailed milestone evaluation history (scores, trait confirmations) is not
 * supported by the current backend API contract and is excluded from beta.
 *
 * Story 21R-2: Remove production frontend mocks from beta-facing code
 * (Replaces mockApi with breedingApi.getFoalDevelopment; evaluation history deferred)
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, AlertCircle } from 'lucide-react';
import { breedingApi } from '@/lib/api-client';
import BetaExcludedNotice from '@/components/beta/BetaExcludedNotice';
import { isBetaMode } from '@/config/betaRouteScope';
import type { MilestoneType } from '@/types/foal';

export interface MilestoneEvaluationDisplayProps {
  foalId: number;
  milestoneType?: MilestoneType;
  showHistory?: boolean;
  autoShowLatest?: boolean;
}

/**
 * MilestoneEvaluationDisplay Component
 *
 * Uses real foal development data for progress display.
 * Detailed evaluation history is excluded from beta.
 */
const MilestoneEvaluationDisplay: React.FC<MilestoneEvaluationDisplayProps> = ({
  foalId,
  showHistory: _showHistory,
  autoShowLatest: _autoShowLatest,
}) => {
  // Fetch real foal development data
  const {
    data: development,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['foalDevelopment', foalId],
    queryFn: () => breedingApi.getFoalDevelopment(foalId),
    enabled: !!foalId,
    staleTime: 60000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        data-testid="milestone-evaluation-loading"
      >
        <div className="h-8 w-8 border-4 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-red-500/30 bg-[rgba(239,68,68,0.1)] p-6"
        data-testid="milestone-evaluation-error"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[rgb(220,235,255)]">Error loading foal development</p>
            <p className="text-sm text-[rgb(148,163,184)] mt-1">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!development) {
    return (
      <div className="text-center py-12" data-testid="milestone-evaluation-empty">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[rgba(15,35,70,0.5)] mb-4">
          <Award className="h-8 w-8 text-[rgb(148,163,184)]" />
        </div>
        <p className="text-[rgb(148,163,184)] text-sm">No development data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="milestone-evaluation-display">
      {/* Development progress using real data */}
      <div className="glass-panel rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 text-[rgb(148,163,184)]" />
          <h3 className="text-lg font-bold text-[rgb(220,235,255)]">Foal Development</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[rgb(148,163,184)]">Day</span>
            <span className="text-sm font-medium text-[rgb(220,235,255)]">
              {development.currentDay} / {development.maxDay}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[rgb(148,163,184)]">Bonding Level</span>
            <span className="text-sm font-medium text-[rgb(220,235,255)]">
              {development.bondingLevel}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[rgb(148,163,184)]">Stress Level</span>
            <span className="text-sm font-medium text-[rgb(220,235,255)]">
              {development.stressLevel}
            </span>
          </div>

          {development.stage && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[rgb(148,163,184)]">Stage</span>
              <span className="text-sm font-medium text-[rgb(220,235,255)]">
                {development.stage}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Detailed evaluation history — beta-readonly: notice only shown in beta mode */}
      {isBetaMode && (
        <BetaExcludedNotice
          testId="milestone-evaluation-beta-notice"
          message="Detailed milestone evaluation history and trait confirmation records are not available in this beta."
        />
      )}
    </div>
  );
};

export default MilestoneEvaluationDisplay;
