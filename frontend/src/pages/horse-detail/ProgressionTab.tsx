/**
 * ProgressionTab — the horse's Points toward its next stat and its Discipline
 * Scores. Equoria-kdduk: extracted from HorseDetailPage.tsx.
 *
 * Owner request 2026-10-28 (Equoria-a0fim): Points are bankable stat currency,
 * not a level — the section shows an "X / 1000 Points" bar with Allocate Stats,
 * and each discipline's score and level. The Horse Points history chart and
 * Recent Gains were removed. Training History stays for now: the owner said
 * "leave the training section on the horse page" (2026-10-28, being confirmed).
 *
 * Owner ruling 2026-10-07: the Age-Up Counter and Training Recommendations
 * panels were removed. Stats never change with age, there is no stat ceiling,
 * no training window, and the game never recommends what to train or enter.
 */

import React from 'react';
import XpProgressBar from '../../components/horse/XpProgressBar';
import ScoreProgressionPanel from '../../components/training/ScoreProgressionPanel';
import DisciplineScoresSection from './DisciplineScoresSection';
import type { Horse } from './HorseDetailPageTypes';

const ProgressionTab: React.FC<{ horse: Horse }> = ({ horse }) => (
  <div className="space-y-8" data-testid="progression-tab">
    <XpProgressBar horseId={horse.id} />
    <DisciplineScoresSection horseId={horse.id} />
    {/* Training history (kept on hold, owner 2026-10-28). */}
    <div data-testid="score-progression-section">
      <ScoreProgressionPanel horseId={horse.id} disciplineScores={horse.disciplineScores} />
    </div>
  </div>
);

export default ProgressionTab;
