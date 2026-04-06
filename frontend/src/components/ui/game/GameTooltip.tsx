/**
 * GameTooltip — Glass panel tooltip (Story 22.6)
 *
 * Composites over tooltip.tsx (Radix Tooltip).
 * Visual: --bg-midnight bg, --gold-dim border, --text-primary text. No backdrop-filter
 * (single-blur rule: only one blur layer active at a time).
 */
export {
  Tooltip as GameTooltip,
  TooltipTrigger as GameTooltipTrigger,
  TooltipContent as GameTooltipContent,
  TooltipProvider as GameTooltipProvider,
} from '@/components/ui/tooltip';
