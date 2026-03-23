import React from 'react';

interface FeaturedHorseCardProps {
  horseName: string;
  horseImage?: string;
  breed: string;
  level: number;
}

const FeaturedHorseCard = ({
  horseName,
  horseImage = '/placeholder.svg',
  breed,
  level,
}: FeaturedHorseCardProps) => {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Main Card */}
      <div className="glass-panel p-6 magical-pulse">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="flex justify-center items-center space-x-2 mb-2">
            <div className="w-8 h-0.5 bg-[rgba(37,99,235,0.5)]" />
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--gold-500)' }} />
            <div className="w-8 h-0.5 bg-[rgba(37,99,235,0.5)]" />
          </div>
          <h2 className="fantasy-caption text-[rgb(148,163,184)]">Featured Companion</h2>
        </div>

        {/* Horse Image */}
        <div className="relative mb-4">
          <div
            className="w-64 h-48 mx-auto rounded-lg overflow-hidden border"
            style={{ borderColor: 'var(--border-active)' }}
          >
            <img src={horseImage} alt={horseName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>

          {/* Level Badge */}
          <div
            className="absolute top-2 right-2 px-3 py-1 rounded-full border magical-glow"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              borderColor: 'rgba(37,99,235,0.6)',
            }}
          >
            <span className="fantasy-caption font-bold text-[var(--text-primary)]">
              LVL {level}
            </span>
          </div>
        </div>

        {/* Horse Info */}
        <div className="text-center">
          <h3 className="fantasy-title text-2xl mb-1">{horseName}</h3>
          <p className="fantasy-header text-lg text-[rgb(148,163,184)] italic">{breed}</p>
        </div>
      </div>
    </div>
  );
};

export default FeaturedHorseCard;
