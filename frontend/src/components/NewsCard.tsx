import React from 'react';
import { ScrollText } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  type: 'achievement' | 'event' | 'update';
}

interface NewsCardProps {
  newsItems: NewsItem[];
}

const NewsCard = ({ newsItems }: NewsCardProps) => {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'achievement':
        return 'text-burnished-gold';
      case 'event':
        return 'text-forest-green';
      case 'update':
        return 'text-aged-bronze';
      default:
        return 'text-midnight-ink';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'achievement':
        return '🏆';
      case 'event':
        return '⚡';
      case 'update':
        return '📜';
      default:
        return '📰';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Header */}
      <div className="bg-aged-bronze parchment-texture p-4 rounded-t-lg gold-border border-b-0">
        <div className="flex items-center justify-center space-x-2">
          <ScrollText className="w-5 h-5 text-parchment" />
          <h3 className="fantasy-header text-xl font-bold text-parchment">Chronicles</h3>
          <ScrollText className="w-5 h-5 text-parchment" />
        </div>
      </div>

      {/* News Content */}
      <div className="bg-parchment parchment-texture rounded-b-lg gold-border border-t-0 max-h-64 overflow-y-auto">
        <div className="p-4 space-y-4">
          {newsItems.map((item, index) => (
            <div
              key={item.id}
              className="pb-4 border-b border-aged-bronze last:border-b-0 hover:bg-burnished-gold hover:bg-opacity-10 transition-colors duration-200 rounded px-2 -mx-2"
            >
              <div className="flex items-start space-x-3">
                <span className="text-lg mt-1 flex-shrink-0">{getTypeIcon(item.type)}</span>
                <div className="flex-1 min-w-0">
                  <h4
                    className={`fantasy-body font-semibold ${getTypeColor(item.type)} text-sm mb-1`}
                  >
                    {item.title}
                  </h4>
                  <p className="fantasy-body text-midnight-ink text-sm leading-relaxed mb-2">
                    {item.content}
                  </p>
                  <p className="fantasy-caption text-aged-bronze text-xs">{item.timestamp}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative Scroll End */}
      <div className="flex justify-center mt-2">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-aged-bronze rounded-full opacity-60" />
          <div className="w-2 h-2 bg-burnished-gold rounded-full opacity-80" />
          <div className="w-2 h-2 bg-aged-bronze rounded-full opacity-60" />
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
