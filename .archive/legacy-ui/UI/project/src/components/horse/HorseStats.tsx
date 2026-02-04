import React from 'react';
import clsx from 'clsx';

interface StatsProps {
  speed: number;
  agility: number;
  stamina: number;
  jumping: number;
}

interface HorseStatsProps {
  stats: StatsProps;
  size?: 'sm' | 'md' | 'lg';
}

const HorseStats: React.FC<HorseStatsProps> = ({ stats, size = 'md' }) => {
  const renderStat = (label: string, value: number) => {
    return (
      <div className="mb-1">
        <div className="flex justify-between items-center mb-1">
          <span
            className={clsx(
              'text-gray-600',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base'
            )}
          >
            {label}
          </span>
          <span
            className={clsx(
              'font-medium',
              size === 'sm' && 'text-xs',
              size === 'md' && 'text-sm',
              size === 'lg' && 'text-base'
            )}
          >
            {value}/100
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-value" style={{ width: `${value}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderStat('Speed', stats.speed)}
      {renderStat('Agility', stats.agility)}
      {renderStat('Stamina', stats.stamina)}
      {renderStat('Jumping', stats.jumping)}
    </div>
  );
};

export default HorseStats;
