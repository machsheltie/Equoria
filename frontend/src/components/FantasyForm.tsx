import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface FantasyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  tooltip?: string;
}

export const FantasyInput = ({ label, error, tooltip, className, ...props }: FantasyInputProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="space-y-2">
      {label && (
        <Label className="fantasy-caption text-aged-bronze uppercase tracking-wider text-sm font-semibold">
          {label}
        </Label>
      )}

      <div className="relative">
        {/* Focus sparkle effect */}
        {isFocused && (
          <div className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-burnished-gold to-transparent opacity-60 shimmer-effect" />
        )}

        <Input
          {...props}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          onMouseEnter={() => tooltip && setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`
            bg-parchment border-2 border-aged-bronze rounded-lg px-3 py-2
            focus:border-burnished-gold focus:ring-1 focus:ring-burnished-gold/50
            fantasy-body text-midnight-ink placeholder:text-aged-bronze/60 placeholder:italic
            transition-all duration-200
            ${error ? 'border-red-500 animate-pulse' : ''}
            ${isFocused ? 'shadow-lg magical-glow' : 'shadow-sm'}
            ${className}
          `}
        />

        {/* Inner gold line */}
        <div className="absolute inset-1 border border-burnished-gold/30 rounded-md pointer-events-none" />

        {/* Tooltip */}
        {showTooltip && tooltip && (
          <div className="absolute top-full left-0 mt-2 z-20 animate-fade-in">
            <div className="bg-midnight-ink text-parchment px-3 py-2 rounded-lg text-sm fantasy-body shadow-xl max-w-xs">
              {tooltip}
              <div className="absolute bottom-full left-4 border-4 border-transparent border-b-midnight-ink" />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm fantasy-body animate-pulse">{error}</p>}
    </div>
  );
};

interface FantasyTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const FantasyTextarea = ({ label, error, className, ...props }: FantasyTextareaProps) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="space-y-2">
      {label && (
        <Label className="fantasy-caption text-aged-bronze uppercase tracking-wider text-sm font-semibold">
          {label}
        </Label>
      )}

      <div className="relative">
        {isFocused && (
          <div className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-burnished-gold to-transparent opacity-60 shimmer-effect" />
        )}

        <Textarea
          {...props}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          className={`
            bg-parchment border-2 border-aged-bronze rounded-xl px-4 py-3
            focus:border-burnished-gold focus:ring-1 focus:ring-burnished-gold/50
            fantasy-body text-midnight-ink placeholder:text-aged-bronze/60 placeholder:italic
            min-h-[100px] resize-vertical
            transition-all duration-200
            ${error ? 'border-red-500 animate-pulse' : ''}
            ${isFocused ? 'shadow-lg magical-glow' : 'shadow-sm'}
            ${className}
          `}
        />

        <div className="absolute inset-2 border border-burnished-gold/30 rounded-lg pointer-events-none" />
      </div>

      {error && <p className="text-red-500 text-sm fantasy-body animate-pulse">{error}</p>}
    </div>
  );
};

interface FantasySelectProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const FantasySelect = ({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: FantasySelectProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-2">
      {label && (
        <Label className="fantasy-caption text-aged-bronze uppercase tracking-wider text-sm font-semibold">
          {label}
        </Label>
      )}

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-parchment border-2 border-aged-bronze rounded-lg px-3 py-2 text-left fantasy-body text-midnight-ink hover:border-burnished-gold transition-colors duration-200 flex items-center justify-between"
        >
          <span>{value ? options.find((opt) => opt.value === value)?.label : placeholder}</span>
          <ChevronDown
            className={`w-5 h-5 text-aged-bronze transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <div className="absolute inset-1 border border-burnished-gold/30 rounded-md pointer-events-none" />

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-parchment border-2 border-aged-bronze rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onValueChange(option.value);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left fantasy-body text-midnight-ink hover:bg-burnished-gold/20 transition-colors duration-150 border-b border-aged-bronze/20 last:border-b-0"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface FantasyCheckboxProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const FantasyCheckbox = ({ label, checked, onCheckedChange }: FantasyCheckboxProps) => {
  return (
    <div className="flex items-center space-x-3">
      <div className="relative">
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="bg-parchment border-2 border-aged-bronze data-[state=checked]:bg-burnished-gold data-[state=checked]:border-burnished-gold rounded-md w-6 h-6"
        />
        {checked && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Check className="w-4 h-4 text-parchment drop-shadow" />
          </div>
        )}
        {checked && (
          <div className="absolute -inset-1 bg-burnished-gold/20 rounded-lg animate-pulse" />
        )}
      </div>
      <Label className="fantasy-body text-midnight-ink cursor-pointer">{label}</Label>
    </div>
  );
};

interface FantasyToggleProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const FantasyToggle = ({ label, checked, onCheckedChange }: FantasyToggleProps) => {
  return (
    <div className="flex items-center justify-between">
      <Label className="fantasy-body text-midnight-ink">{label}</Label>

      <button
        onClick={() => onCheckedChange(!checked)}
        className={`
          relative w-12 h-6 rounded-full transition-all duration-300
          ${checked ? 'bg-forest-green shadow-lg magical-glow' : 'bg-aged-bronze'}
        `}
      >
        <div
          className={`
          absolute top-1 w-4 h-4 bg-parchment rounded-full shadow-md transition-transform duration-300 border border-burnished-gold/50
          ${checked ? 'translate-x-7' : 'translate-x-1'}
        `}
        />

        {checked && (
          <div className="absolute inset-0 rounded-full bg-forest-green/20 animate-pulse" />
        )}
      </button>
    </div>
  );
};
