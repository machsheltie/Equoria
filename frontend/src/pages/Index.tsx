
import React, { useState } from 'react';
import { Menu, Star, Coins, Trophy } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import FantasyButton from '../components/FantasyButton';
import StatCard from '../components/StatCard';
import FeaturedHorseCard from '../components/FeaturedHorseCard';
import NewsCard from '../components/NewsCard';

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const newsItems = [
    {
      id: '1',
      title: 'Shadowmere Reaches Level 15!',
      content: 'Your magnificent stallion has achieved a new milestone through dedicated training.',
      timestamp: '2 hours ago',
      type: 'achievement' as const
    },
    {
      id: '2',
      title: 'Moonlight Tournament',
      content: 'Join the upcoming tournament under the silver moon. Registration ends tomorrow.',
      timestamp: '5 hours ago',
      type: 'event' as const
    },
    {
      id: '3',
      title: 'New Stable Upgrades',
      content: 'Magical enchantments are now available for your stable. Boost your horses\' abilities!',
      timestamp: '1 day ago',
      type: 'update' as const
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-parchment parchment-texture border-b-2 border-aged-bronze shadow-lg relative">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-burnished-gold hover:bg-opacity-20 transition-colors"
          >
            <Menu className="w-6 h-6 text-midnight-ink" />
          </button>
          
          <h1 className="fantasy-title text-3xl text-midnight-ink">
            Equoria
          </h1>
          
          <div className="w-10 h-10 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-aged-bronze flex items-center justify-center">
            <Star className="w-5 h-5 text-parchment" />
          </div>
        </div>
        
        {/* Decorative border */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-aged-bronze via-burnished-gold to-aged-bronze" />
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h2 className="fantasy-header text-2xl text-midnight-ink">
            Welcome back, Noble Rider
          </h2>
          <p className="fantasy-body text-aged-bronze">
            Your mystical companions await your return to the realm
          </p>
        </div>

        {/* Featured Horse */}
        <section>
          <FeaturedHorseCard
            horseName="Stormwind"
            breed="Celestial Stallion"
            level={12}
          />
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-3 gap-4">
          <StatCard
            label="Coins"
            value="2,847"
            icon={<Coins className="w-6 h-6" />}
            tooltip="Currency earned from competitions and quests"
          />
          <StatCard
            label="XP"
            value="15,392"
            icon={<Star className="w-6 h-6" />}
            tooltip="Experience points gained through training"
          />
          <StatCard
            label="Level"
            value="18"
            icon={<Trophy className="w-6 h-6" />}
            tooltip="Your current rider level"
          />
        </section>

        {/* Action Buttons */}
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FantasyButton variant="primary">
              Visit Stable
            </FantasyButton>
            <FantasyButton variant="secondary">
              Explore World
            </FantasyButton>
          </div>
          <FantasyButton variant="primary" size="large" className="w-full">
            Join Tournament
          </FantasyButton>
        </section>

        {/* News/Chronicles */}
        <section>
          <NewsCard newsItems={newsItems} />
        </section>
      </main>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
};

export default Index;