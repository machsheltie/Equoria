import React, { useState } from 'react';
import { Menu, Star, Coins, Trophy } from 'lucide-react';
import Sidebar from '../components/Sidebar';
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
      type: 'achievement' as const,
    },
    {
      id: '2',
      title: 'Moonlight Tournament',
      content: 'Join the upcoming tournament under the silver moon. Registration ends tomorrow.',
      timestamp: '5 hours ago',
      type: 'event' as const,
    },
    {
      id: '3',
      title: 'New Stable Upgrades',
      content:
        "Magical enchantments are now available for your stable. Boost your horses' abilities!",
      timestamp: '1 day ago',
      type: 'update' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-[var(--z-raised)] backdrop-blur-sm border-b"
        style={{
          background: 'var(--glass-surface-heavy-bg)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-[rgba(37,99,235,0.15)] transition-colors"
          >
            <Menu className="w-6 h-6 text-[rgb(148,163,184)]" />
          </button>

          <h1 className="fantasy-title text-3xl">Equoria</h1>

          <div
            className="w-10 h-10 rounded-full border flex items-center justify-center magical-glow"
            style={{
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              borderColor: 'rgba(37,99,235,0.5)',
            }}
          >
            <Star className="w-5 h-5 text-white" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <h2 className="fantasy-header text-2xl text-[rgb(220,235,255)]">
            Welcome back, Noble Rider
          </h2>
          <p className="text-[rgb(148,163,184)]">
            Your mystical companions await your return to the realm
          </p>
        </div>

        {/* Featured Horse */}
        <section>
          <FeaturedHorseCard horseName="Stormwind" breed="Celestial Stallion" level={12} />
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
            <button className="btn-cobalt">Visit Stable</button>
            <button className="btn-outline-celestial">Explore World</button>
          </div>
          <button className="btn-cobalt w-full" style={{ fontSize: '1.1rem', padding: '1rem' }}>
            Join Tournament
          </button>
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
