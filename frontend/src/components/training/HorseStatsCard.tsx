import React from 'react';
import type { TrainableHorse } from '@/lib/api-client';
import { getBreedName } from '@/lib/utils';

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
    <div className="rounded-md border border-[rgba(37,99,235,0.2)] bg-[rgba(15,35,70,0.5)] p-4">
      <h4 className="mb-3 text-sm font-semibold text-[rgb(220,235,255)]">Horse Stats</h4>

      {/* Horse Name and Level */}
      <div className="mb-3">
        <p className="text-lg font-bold text-[rgb(220,235,255)]">{horse.name}</p>
        {horse.level !== undefined && (
          <p className="text-sm text-[rgb(148,163,184)]">Level {horse.level}</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-2">
        {horse.breed && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-[rgb(148,163,184)]">Breed:</span>
            <span className="text-[rgb(220,235,255)]">{getBreedName(horse.breed)}</span>
          </div>
        )}

        {horse.ageYears !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-[rgb(148,163,184)]">Age:</span>
            <span className="text-[rgb(220,235,255)]">{formatAge(horse.ageYears)}</span>
          </div>
        )}

        {horse.gender && (
          <div className="flex justify-between text-sm">
            <span className="font-medium text-[rgb(148,163,184)]">Gender:</span>
            <span className="text-[rgb(220,235,255)]">{horse.gender}</span>
          </div>
        )}

        {horse.bestDisciplines && horse.bestDisciplines.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[rgba(37,99,235,0.2)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(148,163,184)] mb-1">
              Best Disciplines:
            </p>
            <p className="text-sm text-[rgb(220,235,255)]">{horse.bestDisciplines.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HorseStatsCard;
