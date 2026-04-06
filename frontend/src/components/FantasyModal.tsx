import React from 'react';
import { X } from 'lucide-react';
import {
  GameDialog as Dialog,
  GameDialogContent as DialogContent,
  GameDialogHeader as DialogHeader,
  GameDialogTitle as DialogTitle,
} from '@/components/ui/game';

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
  isRare = false,
}: FantasyModalProps) => {
  const getAccentColor = () => {
    switch (type) {
      case 'training':
        return 'rgb(37,99,235)';
      case 'vet':
        return 'rgb(16,185,129)';
      case 'breeding':
        return 'rgb(244,114,182)';
      case 'event':
        return 'rgb(212,168,67)';
      default:
        return 'rgb(212,168,67)';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`max-w-[90vw] max-h-[80vh] p-0 border-0 bg-transparent overflow-hidden ${isRare ? 'animate-pulse' : ''}`}
      >
        {/* Glow ring for rare modals */}
        {isRare && (
          <div className="absolute -inset-1 rounded-2xl opacity-40 magical-glow pointer-events-none" />
        )}

        {/* Main panel */}
        <div className="glass-panel p-6 overflow-hidden relative">
          {/* Header */}
          <DialogHeader className="mb-6">
            <DialogTitle
              className="fantasy-title text-2xl text-center"
              style={{ color: getAccentColor() }}
            >
              {title}
            </DialogTitle>
          </DialogHeader>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center hover:scale-110 transition-transform z-[var(--z-sticky)]"
            style={{
              background: 'rgba(37,99,235,0.2)',
              border: '1px solid rgba(37,99,235,0.4)',
            }}
          >
            <X className="w-4 h-4 text-[rgb(220,235,255)]" />
          </button>

          {/* Content area */}
          <div className="relative z-[var(--z-raised)] max-h-[60vh] overflow-y-auto">
            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FantasyModal;
