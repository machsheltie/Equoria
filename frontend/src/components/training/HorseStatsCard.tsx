import React from 'react';
import type { TrainableHorse } from '@/lib/api-client';

interface HorseStatsCardProps {
  horse: TrainableHorse;
}

const HorseStatsCard: React.FC<HorseStatsCardProps> = ({ horse }) => {
  const formatAge = (age: number | undefined): string | null => {
    if (age === undefined) return null;
    return age === 1 ? `${age} year` : `${age} years`;
  };

  const hasAnyStats =
    horse.level !== undefined ||
    horse.breed !== undefined ||
    horse.ageYears !== undefined ||
    horse.gender !== undefined ||
    (horse.bestDisciplines && horse.bestDisciplines.length > 0);

  if (!hasAnyStats) {
    return null;
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-3 text-sm font-semibold text-slate-700">Horse Stats</h4>

      {/* Horse Name and Level */}
      <div className="mb-3">
        <p className="text-lg font-bold text-slate-900">{horse.name}</p>
        {horse.level !== undefined && <p className="text-sm text-slate-600">Level {horse.level}</p>}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-2">
        {horse.breed && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-600">Breed:</span>
            <span className="text-slate-900">{horse.breed}</span>
          </div>
        )}

        {horse.ageYears !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-600">Age:</span>
            <span className="text-slate-900">{formatAge(horse.ageYears)}</span>
          </div>
        )}

        {horse.gender && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-slate-600">Gender:</span>
            <span className="text-slate-900">{horse.gender}</span>
          </div>
        )}

        {horse.bestDisciplines && horse.bestDisciplines.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Best Disciplines:
            </p>
            <p className="text-sm text-slate-900">{horse.bestDisciplines.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HorseStatsCard;
