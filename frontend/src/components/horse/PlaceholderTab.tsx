import React from 'react';
import { AlertCircle } from 'lucide-react';

interface PlaceholderTabProps {
  title: string;
}

const PlaceholderTab: React.FC<PlaceholderTabProps> = ({ title }) => (
  <div className="text-center py-12 flex flex-col items-center justify-center">
    <div className="bg-white/5 p-4 rounded-full mb-4">
      <AlertCircle className="w-8 h-8 text-celestial-gold opacity-80" />
    </div>
    <h3 className="font-heading text-2xl text-[var(--text-primary)] mb-2">{title}</h3>
    <p className="font-body text-starlight-white/60 max-w-md">
      This section is currently being upgraded to the Celestial interface. Check back soon for
      enhanced features!
    </p>
  </div>
);

export default PlaceholderTab;
