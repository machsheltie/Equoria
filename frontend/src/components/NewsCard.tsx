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
        return 'text-[rgb(212,168,67)]';
      case 'event':
        return 'text-[rgb(37,99,235)]';
      case 'update':
        return 'text-[rgb(148,163,184)]';
      default:
        return 'text-[rgb(220,235,255)]';
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
      <div
        className="p-4 rounded-t-lg border border-b-0"
        style={{
          background: 'rgba(37,99,235,0.15)',
          borderColor: 'rgba(37,99,235,0.3)',
        }}
      >
        <div className="flex items-center justify-center space-x-2">
          <ScrollText className="w-5 h-5 text-[rgb(212,168,67)]" />
          <h3 className="fantasy-header text-xl font-bold text-[rgb(220,235,255)]">Chronicles</h3>
          <ScrollText className="w-5 h-5 text-[rgb(212,168,67)]" />
        </div>
      </div>

      {/* News Content */}
      <div
        className="rounded-b-lg border border-t-0 max-h-64 overflow-y-auto"
        style={{
          background: 'rgba(10,22,40,0.75)',
          borderColor: 'rgba(37,99,235,0.3)',
        }}
      >
        <div className="p-4 space-y-4">
          {newsItems.map((item) => (
            <div
              key={item.id}
              className="pb-4 border-b last:border-b-0 hover:bg-[rgba(37,99,235,0.05)] transition-colors duration-200 rounded px-2 -mx-2"
              style={{ borderColor: 'var(--border-muted)' }}
            >
              <div className="flex items-start space-x-3">
                <span className="text-lg mt-1 flex-shrink-0">{getTypeIcon(item.type)}</span>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold text-sm mb-1 ${getTypeColor(item.type)}`}>
                    {item.title}
                  </h4>
                  <p className="text-sm leading-relaxed mb-2 text-[rgb(220,235,255)]">
                    {item.content}
                  </p>
                  <p className="text-xs text-[rgb(100,130,165)]">{item.timestamp}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
