# Breeding System Documentation

**Skill:** `/breeding-system`
**Purpose:** Load breeding mechanics and genetics documentation

---

## When to Use This Skill

Invoke this skill when:

- Implementing breeding endpoints
- Working on genetic inheritance algorithms
- Debugging breeding validation
- Understanding breeding cooldowns
- Working with offspring stat calculation

---

## Quick Breeding Overview

### Core Mechanics

- **Genetic Inheritance:** Complex stat inheritance from sire and dam
- **Breeding Cooldowns:** 30-day cooldown between breedings
- **Age Requirements:** Minimum breeding age enforcement
- **Health Checks:** Injured horses cannot breed
- **Self-Breeding Prevention:** Horses cannot breed with themselves

### Key Validation Rules

```javascript
// Breeding requirements
- Sire must be male
- Dam must be female
- Both must be 3+ years old
- Neither can be injured
- Both must be owned by user (or dam owned if using sire fee)
- Must respect 30-day cooldown
```

---

## Documentation Locations

### Full Breeding Documentation

```bash
# Epigenetic traits and genetics
cat .claude/docs/systems/epigenetictraits.md

# Advanced epigenetic system
cat .claude/docs/systems/advancedepigenetictraitsystem.md

# Epigenetic expansion (Phase 2)
cat .claude/docs/systems/epigeneticexpansionphase2.md

# Advanced epigenetics plan
cat .claude/docs/systems/advancedepigeneticsplan.md
```

### API Implementation

- Breeding endpoints: `backend/routes/breedingRoutes.mjs`
- Breeding controller: `backend/controllers/breedingController.mjs`
- Breeding model: `backend/models/breedingModel.mjs`

---

## Key Concepts

### Genetic Inheritance Algorithm

1. **Base Stats:** Average of sire and dam stats
2. **Genetic Variation:** ±10% random variation
3. **Trait Inheritance:** Epigenetic trait passing
4. **Bloodline Tracking:** Ancestry tracking for ultra-rare traits

### Breeding Cooldown Management

- Global 30-day cooldown per horse
- Tracked in `lastBreedingDate` field
- Server-side validation (client timestamps ignored)

### Epigenetic Flags

- Breeding-influenced flags
- Environmental triggers during gestation
- Long-term trait unlocking based on breeding patterns

---

## Common Tasks

### Implementing New Breeding Feature

1. Load `/breeding-system` skill
2. Review epigenetic documentation
3. Understand genetic inheritance algorithm
4. Implement with proper validation
5. Write tests following balanced mocking

### Debugging Breeding Issue

1. Check cooldown validation
2. Verify age and health requirements
3. Review genetic calculation logic
4. Check epigenetic flag evaluation

---

**Load full documentation:**

```bash
cat .claude/docs/systems/epigenetictraits.md
cat .claude/docs/systems/advancedepigenetictraitsystem.md
```
