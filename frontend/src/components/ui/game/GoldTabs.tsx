/**
 * GoldTabs — Transparent tab list with animated gold underline indicator (Story 22.6)
 *
 * Composites over tabs.tsx (Radix Tabs + Cinzel font + gold underline).
 * Visual: transparent bg tab list, active tab: var(--text-gold) + animated 2px gold underline
 * (200ms ease), inactive: var(--text-secondary), Cinzel font, no background-fill on active.
 *
 * All colour values come from CSS custom property tokens — no raw hex or rgba literals.
 */
export {
  Tabs as GoldTabs,
  TabsList as GoldTabsList,
  TabsTrigger as GoldTabsTrigger,
  TabsContent as GoldTabsContent,
} from '@/components/ui/tabs';
