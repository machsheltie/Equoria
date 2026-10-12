/**
 * ProgressionTab — XP bar, stat progression chart, recent gains,
 * score progression panel.
 * Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Owner ruling 2026-10-07: the Age-Up Counter and Training Recommendations
 * panels were removed. Stats never change with age, there is no stat ceiling,
 * no training window, and the game never recommends what to train or enter.
 */

import React from 'react';
import XpProgressBar from '../../components/horse/XpProgressBar';
import StatProgressionChart from '../../components/horse/StatProgressionChart';
import RecentGains from '../../components/horse/RecentGains';
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

    {/* Recent Gains - Full Width */}
    <div className="col-span-full">
      <RecentGains horseId={horse.id} />
    </div>

    {/* Score Progression Panel - Discipline scores and training history */}
    <div className="col-span-full" data-testid="score-progression-section">
      <ScoreProgressionPanel horseId={horse.id} className="mt-4" />
    </div>
  </div>
);

export default ProgressionTab;
