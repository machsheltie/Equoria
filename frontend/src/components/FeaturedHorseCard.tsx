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
      {/* Decorative Frame */}
      <div className="absolute -inset-4 bg-gradient-to-br from-burnished-gold via-aged-bronze to-burnished-gold p-1 rounded-xl">
        <div className="absolute inset-0 parchment-texture rounded-xl" />
      </div>

      {/* Main Card */}
      <div className="relative bg-parchment parchment-texture rounded-lg p-6 magical-pulse">
        {/* Ornamental Header */}
        <div className="text-center mb-4">
          <div className="flex justify-center items-center space-x-2 mb-2">
            <div className="w-8 h-0.5 bg-burnished-gold" />
            <div className="w-2 h-2 bg-burnished-gold rounded-full" />
            <div className="w-8 h-0.5 bg-burnished-gold" />
          </div>
          <h2 className="fantasy-caption text-aged-bronze">Featured Companion</h2>
        </div>

        {/* Horse Image */}
        <div className="relative mb-4">
          <div className="w-64 h-48 mx-auto rounded-lg overflow-hidden border-2 border-aged-bronze">
            <img src={horseImage} alt={horseName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight-ink/20 to-transparent" />
          </div>

          {/* Level Badge */}
          <div className="absolute top-2 right-2 bg-forest-green text-parchment px-3 py-1 rounded-full border border-burnished-gold">
            <span className="fantasy-caption font-bold">LVL {level}</span>
          </div>
        </div>

        {/* Horse Info */}
        <div className="text-center">
          <h3 className="fantasy-title text-2xl text-midnight-ink mb-2">{horseName}</h3>
          <p className="fantasy-header text-lg text-aged-bronze italic">{breed}</p>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-4 left-4">
          <div className="w-6 h-6 border-2 border-burnished-gold rounded-full bg-gradient-to-br from-burnished-gold/30 to-transparent" />
        </div>
        <div className="absolute top-4 right-4">
          <div className="w-6 h-6 border-2 border-burnished-gold rounded-full bg-gradient-to-bl from-burnished-gold/30 to-transparent" />
        </div>
        <div className="absolute bottom-4 left-4">
          <div className="w-6 h-6 border-2 border-burnished-gold rounded-full bg-gradient-to-tr from-burnished-gold/30 to-transparent" />
        </div>
        <div className="absolute bottom-4 right-4">
          <div className="w-6 h-6 border-2 border-burnished-gold rounded-full bg-gradient-to-tl from-burnished-gold/30 to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default FeaturedHorseCard;
