/**
 * ProgressionTab — XP bar, stat progression chart, recent gains,
 * age-up counter, training recommendations, score progression panel.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 */

import React from 'react';
import XpProgressBar from '../../components/horse/XpProgressBar';
import StatProgressionChart from '../../components/horse/StatProgressionChart';
import RecentGains from '../../components/horse/RecentGains';
import AgeUpCounter from '../../components/horse/AgeUpCounter';
import TrainingRecommendations from '../../components/horse/TrainingRecommendations';
import ScoreProgressionPanel from '../../components/training/ScoreProgressionPanel';
import type { Horse } from './HorseDetailPageTypes';

const ProgressionTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6" data-testid="progression-tab">
    {/* XP Progress Bar - Full Width */}
    <div className="col-span-full">
      <XpProgressBar horseId={horse.id} />
    </div>

    {/* Stat Progression Chart - Full Width */}
    <div className="col-span-full">
      <StatProgressionChart horseId={horse.id} />
    </div>

    {/* Recent Gains and Age Counter - Two Column Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="col-span-1">
        <RecentGains horseId={horse.id} />
      </div>
      <div className="col-span-1">
        <AgeUpCounter horseId={horse.id} />
      </div>
    </div>

    {/* Training Recommendations - Full Width */}
    <div className="col-span-full">
      <TrainingRecommendations horseId={horse.id} />
    </div>

    {/* Score Progression Panel - Discipline scores and training history */}
    <div className="col-span-full" data-testid="score-progression-section">
      <ScoreProgressionPanel horseId={horse.id} className="mt-4" />
    </div>
  </div>
);

export default ProgressionTab;
