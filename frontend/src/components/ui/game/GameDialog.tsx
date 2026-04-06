/**
 * GameDialog — Cinematic overlay dialog (Story 22.6)
 *
 * Composites over dialog.tsx (Radix Dialog + glass-panel-heavy content).
 * Visual: dark velvet backdrop (var(--backdrop-velvet)), glass-panel-heavy content,
 * Cinzel title in var(--text-gold), animated entrance (scale + fade).
 *
 * All colour values come from CSS custom property tokens — no raw hex or rgba literals.
 */
export {
  Dialog as GameDialog,
  DialogTrigger as GameDialogTrigger,
  DialogContent as GameDialogContent,
  DialogHeader as GameDialogHeader,
  DialogFooter as GameDialogFooter,
  DialogTitle as GameDialogTitle,
  DialogDescription as GameDialogDescription,
  DialogClose as GameDialogClose,
  DialogOverlay as GameDialogOverlay,
  DialogPortal as GameDialogPortal,
} from '@/components/ui/dialog';
