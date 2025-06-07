import React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface FantasyModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  type?: 'training' | 'vet' | 'breeding' | 'event';
  isRare?: boolean;
}

const FantasyModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  type = 'event',
  isRare = false 
}: FantasyModalProps) => {
  const getModalAccent = () => {
    switch (type) {
      case 'training': return 'text-forest-green';
      case 'vet': return 'text-emerald-600';
      case 'breeding': return 'text-rose-400';
      case 'event': return 'text-burnished-gold';
      default: return 'text-burnished-gold';
    }
  };

  const getOverlayMotif = () => {
    switch (type) {
      case 'training': return (
        <div className="absolute top-4 right-4 opacity-10">
          <div className="w-16 h-16 border-2 border-forest-green rounded-full" />
          <div className="absolute inset-2 border border-forest-green transform rotate-45" />
        </div>
      );
      case 'vet': return (
        <div className="absolute top-4 right-4 opacity-10">
          <div className="w-12 h-16 border-2 border-emerald-600 rounded-t-full" />
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-8 border-2 border-emerald-600" />
        </div>
      );
      case 'breeding': return (
        <div className="absolute top-4 right-4 opacity-10">
          <div className="w-8 h-8 bg-rose-400 transform rotate-45 rounded-tl-lg rounded-br-lg" />
        </div>
      );
      default: return (
        <div className="absolute top-4 right-4 opacity-10">
          <div className="w-12 h-12 border-2 border-burnished-gold rounded-full" />
          <div className="absolute inset-2 border border-burnished-gold" />
        </div>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`
        max-w-[90vw] max-h-[80vh] p-0 border-0 bg-transparent overflow-hidden
        ${isRare ? 'animate-pulse' : ''}
      `}>
        {/* Magical sparkle effects for rare modals */}
        {isRare && (
          <>
            <div className="absolute -top-2 -left-2 w-4 h-4 bg-burnished-gold rounded-full animate-ping opacity-75" />
            <div className="absolute -top-2 -right-2 w-3 h-3 bg-aged-bronze rounded-full animate-ping opacity-75 animation-delay-200" />
            <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-burnished-gold rounded-full animate-ping opacity-75 animation-delay-400" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-aged-bronze rounded-full animate-ping opacity-75 animation-delay-600" />
          </>
        )}

        {/* Outer gold scroll border */}
        <div className="absolute -inset-1 bg-gradient-to-br from-burnished-gold via-aged-bronze to-burnished-gold rounded-3xl p-1">
          <div className="absolute inset-0 parchment-texture rounded-3xl opacity-20" />
        </div>

        {/* Inner bronze border */}
        <div className="relative bg-parchment parchment-texture rounded-3xl border-2 border-aged-bronze p-6 shadow-2xl overflow-hidden">
          {/* Background motif overlay */}
          {getOverlayMotif()}

          {/* Grunge patina and gold flakes */}
          <div className="absolute inset-0 bg-gradient-to-br from-burnished-gold/5 via-transparent to-aged-bronze/5 rounded-3xl" />
          <div className="absolute top-1/4 left-1/3 w-2 h-2 bg-burnished-gold/20 rounded-full" />
          <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-burnished-gold/30 rounded-full" />
          <div className="absolute bottom-1/3 left-1/4 w-1.5 h-1.5 bg-aged-bronze/20 rounded-full" />

          {/* Header scroll band */}
          <div className="relative mb-6">
            <div className="absolute -inset-x-6 -inset-y-2 bg-gradient-to-r from-burnished-gold/20 via-aged-bronze/10 to-burnished-gold/20 border-y border-aged-bronze/30" />
            <DialogHeader className="relative z-10">
              <DialogTitle className={`
                fantasy-title text-2xl text-center ${getModalAccent()}
                drop-shadow-sm
              `}>
                {title}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Close button - wax seal style */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-gradient-to-br from-burnished-gold to-aged-bronze rounded-full border-2 border-parchment shadow-lg hover:scale-110 transition-transform duration-200 z-20"
          >
            <div className="absolute inset-1 bg-gradient-to-br from-burnished-gold/30 to-transparent rounded-full" />
            <X className="w-5 h-5 text-parchment absolute inset-0 m-auto drop-shadow" />
          </button>

          {/* Content area */}
          <div className="relative z-10 max-h-[60vh] overflow-y-auto">
            {children}
          </div>

          {/* Decorative corner flourishes */}
          <div className="absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-burnished-gold/40 rounded-tl-lg" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-burnished-gold/40 rounded-br-lg" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FantasyModal;
