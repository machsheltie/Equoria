import React from 'react';

import XPProgressBar from './XPProgressBar';
import StatProgressionChart from './StatProgressionChart';
import RecentGains from './RecentGains';
import AgeUpCounter from './AgeUpCounter';
import TrainingRecommendations from './TrainingRecommendations';
import ScoreProgressionPanel from '../training/ScoreProgressionPanel';

// Temporary Horse interface until we have a shared type file
interface HorseStats {
  speed: number;
  stamina: number;
  agility: number;
  strength: number;
  intelligence: number;
  health: number;
}

interface Horse {
  id: number;
  name: string;
  breed: string;
  breedId?: number;
  age: number;
  gender: string;
  dateOfBirth: string;
  healthStatus: string;
  imageUrl?: string;
  stats: HorseStats;
  disciplineScores: Record<string, number>;
  traits?: string[];
  description?: string;
  parentIds?: {
    sireId?: number;
    damId?: number;
  };
}

const ProgressionTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-6 animate-fade-in-up" data-testid="progression-tab">
    {/* XP Progress Bar - Full Width */}
    <div className="col-span-full">
      <XPProgressBar horseId={horse.id} />
    </div>

    {/* Stat Progression Chart - Full Width */}
    <div className="col-span-full bg-black/20 rounded-xl p-4 border border-white/5">
      <StatProgressionChart horseId={horse.id} />
    </div>

    {/* Recent Gains and Age Counter - Two Column Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="col-span-1 bg-black/20 rounded-xl p-4 border border-white/5">
        <RecentGains horseId={horse.id} />
      </div>
      <div className="col-span-1 bg-black/20 rounded-xl p-4 border border-white/5">
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
