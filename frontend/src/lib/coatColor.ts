/**
 * "Bay — Dark": a horse's visible coat color with its shade (owner ruling
 * q214, 2026-10-28). The shade is the stored phenotype word, title-cased.
 * Unknown color reads "not recorded", never "Unknown".
 */
export function colorWithShade(colorName: string | null | undefined, shade: unknown): string {
  if (!colorName) return 'not recorded';
  const shadeText = typeof shade === 'string' ? shade.trim() : '';
  if (!shadeText) return colorName;
  return `${colorName} — ${shadeText.replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
}
