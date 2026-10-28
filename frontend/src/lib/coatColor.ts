/**
 * "Bay — Dark": a horse's visible coat color with its shade (owner ruling
 * q214, 2026-10-28). The shade is the stored phenotype word, title-cased.
 * The plain "standard" shade is not shown: the row reads just "Bay" (owner
 * ruling q239, 2026-10-28).
 * Unknown color reads "not recorded", never "Unknown".
 */
export function colorWithShade(colorName: string | null | undefined, shade: unknown): string {
  if (!colorName) return 'not recorded';
  const shadeText = typeof shade === 'string' ? shade.trim() : '';
  if (!shadeText || shadeText.toLowerCase() === 'standard') return colorName;
  return `${colorName} — ${shadeText.replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
}
