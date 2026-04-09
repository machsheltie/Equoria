# Story 31E-4: Color Genetics API Endpoints

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-4-color-genetics-api-endpoints
**Status:** done

---

## Story

As a player,
I want to view my horse's genetics, coat color, and markings,
So that I can understand my horse's color and plan breeding.

---

## Acceptance Criteria

**AC1 — GET /api/v1/horses/:id/genetics**
Given a horse exists with genotype and phenotype,
When `GET /api/v1/horses/:id/genetics` is called,
Then response includes full colorGenotype (allele pairs per locus) + calculated phenotype,
And response time is <300ms.

**AC2 — GET /api/v1/horses/:id/color**
Given a horse exists with phenotype,
When `GET /api/v1/horses/:id/color` is called,
Then response includes display color name, shade variant, face marking, leg markings, advanced markings, boolean modifiers,
And colorGenotype is NOT included (player-facing summary only),
And response time is <200ms.

**AC3 — Legacy horse handling**
Given a horse exists without colorGenotype (legacy horse),
When either endpoint is called,
Then response returns 200 with `null` data and a descriptive message.

**AC4 — JSONB type guard**
Given `colorGenotype` or `phenotype` is stored as an array or string (malformed JSONB),
When either endpoint is called,
Then the guard catches it and returns 200 with null data (same as legacy handling).

**AC5 — Ownership enforcement**
Given a user who does not own the horse,
When either endpoint is called,
Then it returns 401/403 via `requireOwnership` middleware.

---

## Tasks / Subtasks

- [x] T1: Add `getGenetics(req, res)` controller function to `horseController.mjs`
  - [x] T1.1: Use `req.horse` from `requireOwnership` middleware (do not fetch horse again)
  - [x] T1.2: JSONB type guard for `colorGenotype` and `phenotype`
  - [x] T1.3: Return `{ horseId, horseName, colorGenotype, phenotype }` for valid data
  - [x] T1.4: Return `{ success: true, data: null, message: '...' }` for legacy/null/malformed
  - [x] T1.5: `req.horse` null guard (500 if middleware contract violated)
- [x] T2: Add `getColor(req, res)` controller function to `horseController.mjs`
  - [x] T2.1: Return only display fields — no colorGenotype in response
  - [x] T2.2: Extract: colorName, shade, faceMarking, legMarkings, advancedMarkings, modifiers from phenotype
  - [x] T2.3: JSONB type guard for `phenotype`
  - [x] T2.4: `req.horse` null guard
- [x] T3: Wire routes into `horseRoutes.mjs`
  - [x] T3.1: `GET /:id/genetics` with `requireOwnership('horse')` middleware
  - [x] T3.2: `GET /:id/color` with `requireOwnership('horse')` middleware
  - [x] T3.3: Both routes placed BEFORE catch-all `GET /:id` route
  - [x] T3.4: `rejectPollutedRequest` middleware on both routes
- [x] T4: Write tests (~20 controller mock tests)
  - [x] T4.1: getGenetics — success response shape (4 keys: horseId, horseName, colorGenotype, phenotype)
  - [x] T4.2: getGenetics — legacy horse null genotype → 200 null
  - [x] T4.3: getGenetics — undefined genotype → 200 null
  - [x] T4.4: getGenetics — phenotype null when genotype present → 200 null phenotype
  - [x] T4.5: getGenetics — req.horse missing → 500
  - [x] T4.6: getGenetics — array genotype (JSONB guard) → 200 null
  - [x] T4.7: getGenetics — string genotype (JSONB guard) → 200 null
  - [x] T4.8: getGenetics — horse with no genotype → 200 null
  - [x] T4.9: getColor — success response shape (no colorGenotype field)
  - [x] T4.10: getColor — marking fields null when phenotype has no markings
  - [x] T4.11: getColor — legacy horse no phenotype → 200 null
  - [x] T4.12: getColor — undefined phenotype → 200 null
  - [x] T4.13: getColor — req.horse missing → 500
  - [x] T4.14: getColor — array phenotype (JSONB guard) → 200 null
  - [x] T4.15: getColor — string phenotype (JSONB guard) → 200 null
  - [x] T4.16: getColor — horse with no phenotype → 200 null

---

## Dev Notes

### Middleware Pattern — req.horse

Both endpoints use `requireOwnership('horse')` middleware which populates `req.horse` before the controller runs. Do NOT fetch the horse again inside the controller. If `req.horse` is missing, the middleware contract is violated — return 500.

```javascript
export async function getGenetics(req, res) {
  try {
    if (!req.horse) {
      return res.status(500).json({ success: false, message: 'Horse not loaded by middleware' });
    }
    if (!isValidGenotype(req.horse.colorGenotype)) {
      return res.status(200).json({ success: true, data: null, message: 'No genetics data' });
    }
    return res.status(200).json({
      success: true,
      data: { horseId: req.horse.id, horseName: req.horse.name, colorGenotype: req.horse.colorGenotype, phenotype: req.horse.phenotype },
    });
  } catch (error) {
    logger.error(`[horseController.getGenetics] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
```

### JSONB Type Guard

```javascript
function isValidGenotype(value) {
  return (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value)
  );
}
```

### Discovered During Development

- **Route ordering**: `GET /:id/genetics` and `GET /:id/color` MUST be declared before `GET /:id` in horseRoutes.mjs — otherwise the catch-all `/:id` route captures them. This caused a bug in development.
- **rejectPollutedRequest**: Required on all new routes per project convention.
- **eqeqeq**: Use strict equality. Loose `!=` triggers lint error.
- **lint-staged + Windows**: Same rollup lock file stash pop issue as 31E-3. Ensure all lint passes before committing.

### File Locations

- Controller functions: `backend/modules/horses/controllers/horseController.mjs` (appended)
- Route additions: `backend/modules/horses/routes/horseRoutes.mjs`
- Tests: `backend/__tests__/colorGeneticsApi.test.mjs`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- AC1: GET /genetics returns colorGenotype + phenotype; JSONB guard for malformed data
- AC2: GET /color returns display fields only; colorGenotype excluded from response
- AC3: Legacy horses return 200 with null data and descriptive message
- AC4: JSONB type guard handles array and string stored types
- AC5: Ownership enforced via requireOwnership middleware (401/403)

### File List

- `backend/modules/horses/controllers/horseController.mjs` — modified (getGenetics, getColor, isValidGenotype appended)
- `backend/modules/horses/routes/horseRoutes.mjs` — modified (2 new GET routes, placed before /:id)
- `backend/__tests__/colorGeneticsApi.test.mjs` — new (~20 controller mock tests)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-03 | Implementation complete — both endpoints, JSONB guards, route ordering, 20 tests passing |

---

*Note: This artifact was reconstructed from the TEA:TR report and epic specification on 2026-04-09 as part of the Epic 31E retrospective story-preservation action item. The original story file was not saved to implementation-artifacts/ during development.*
