# Horse Art Assets

This directory holds horse portrait images used in HorseCard and HorseDetailPage.

## Expected Structure

```
horses/
  placeholder.svg          ← generic fallback (root /placeholder.svg)
  generic-mare.svg
  generic-stallion.svg
  generic-foal.svg
  breeds/
    thoroughbred-bay.jpg
    arabian-grey.jpg
    ...
```

## Naming Convention

`{breed-slug}-{color}.{ext}` — e.g., `thoroughbred-bay.jpg`, `arabian-grey.png`

For gender-specific fallbacks: `generic-{sex}.svg`

## Status

Art assets are pending. All components currently fall back to `/placeholder.svg`.
When real assets are available, update `HorseCard.tsx` default prop and the
backend `Horse.imageUrl` seed data.
