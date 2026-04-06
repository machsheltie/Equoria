/**
 * FrostedPanel — Game-native glass surface container (Story 22.6)
 *
 * Composites over card.tsx (Celestial Night glass-panel skeleton).
 * Visual: backdrop-filter blur(12px), rgba(15,23,42,0.6) bg, gold border on hover, border-radius 12px.
 * Use instead of <Card> for all game content areas.
 *
 * All colour values come from CSS custom property tokens (var(--gold-primary), etc.)
 * — no raw hex or rgba literals in this file.
 */
export {
  Card as FrostedPanel,
  CardHeader as FrostedPanelHeader,
  CardTitle as FrostedPanelTitle,
  CardDescription as FrostedPanelDescription,
  CardContent as FrostedPanelContent,
  CardFooter as FrostedPanelFooter,
} from '@/components/ui/card';
