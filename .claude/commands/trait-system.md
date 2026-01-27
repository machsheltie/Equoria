# Trait System Documentation

**Skill:** `/trait-system`
**Purpose:** Load trait discovery and epigenetic system documentation

---

## When to Use This Skill

Invoke this skill when:

- Implementing trait discovery endpoints
- Working on epigenetic flag evaluation
- Understanding milestone-based unlocking
- Debugging ultra-rare trait mechanics
- Working with long-term trait progression

---

## Quick Trait Overview

### Core Mechanics

- **Progressive Discovery:** Traits unlock over time through gameplay
- **Epigenetic Flags:** Environmental and care-based triggers
- **Milestone System:** Age-based and achievement-based unlocking
- **Ultra-Rare Traits:** Legendary bloodline mechanics
- **Long-Term Traits:** Multi-generation trait accumulation

### Trait Categories

```javascript
{
  "genetic": "Inherited from parents",
  "epigenetic": "Unlocked through care/environment",
  "milestone": "Unlocked at specific ages/achievements",
  "ultra-rare": "Legendary bloodline traits (0.1% chance)",
  "long-term": "Multi-generation accumulation"
}
```

---

## Documentation Locations

### Full Trait Documentation

```bash
# Epigenetic traits system
cat .claude/docs/systems/epigenetictraits.md

# Epigenetic flag system
cat .claude/docs/systems/epigenetictraitflagsystem.md

# Ultra-rare exotic traits
cat .claude/docs/systems/ultrarareexotictraits.md

# Long-term trait system
cat .claude/docs/systems/longtermtrait.md

# Post-milestone trait validation
cat .claude/docs/systems/postmilestonetraitvalidation.md

# Advanced epigenetic system
cat .claude/docs/systems/advancedepigenetictraitsystem.md

# Trait modifiers
cat .claude/docs/systems/trait-modifiers.md
```

### API Implementation

- Trait endpoints: `backend/routes/traitRoutes.mjs`
- Trait controller: `backend/controllers/traitController.mjs`
- Trait discovery: `backend/utils/traitDiscovery.mjs`

---

## Key Concepts

### Trait Discovery Algorithm

1. **Flag Evaluation:** Check epigenetic flags (care patterns, environment)
2. **Milestone Checking:** Verify age and achievement milestones
3. **Probability Calculation:** Apply rarity probabilities
4. **Trait Unlocking:** Add trait to horse's trait list
5. **Notification:** Generate trait discovery event

### Epigenetic Flag System

```javascript
// Flags that influence trait discovery
{
  "high_quality_care": "Groom assignment, daily interactions",
  "training_intensity": "Training frequency and variety",
  "nutrition_quality": "Feeding patterns",
  "social_exposure": "Horse interactions",
  "competitive_success": "Competition performance"
}
```

### Ultra-Rare Trait Mechanics

- **Legendary Bloodlines:** 0.1% base probability
- **Lineage Multipliers:** Increase chance based on ancestry
- **Multi-Generation:** Traits accumulate across generations
- **Permanent Benefits:** Significant stat bonuses and unique abilities

### Milestone-Based Unlocking

```javascript
// Age-based milestones
{
  "birth": ["Conformation traits"],
  "6_months": ["Early development traits"],
  "1_year": ["Juvenile traits"],
  "3_years": ["Maturity traits"],
  "5_years": ["Prime traits"],
  "10_years": ["Veteran traits"]
}
```

---

## Common Tasks

### Implementing Trait Discovery

1. Load `/trait-system` skill
2. Review epigenetic flag documentation
3. Understand probability calculations
4. Implement discovery algorithm
5. Write tests for various scenarios

### Debugging Trait Issues

1. Check epigenetic flag evaluation
2. Verify milestone requirements
3. Review probability calculations
4. Check trait assignment logic
5. Validate trait effects

### Adding New Trait Type

1. Define trait properties and effects
2. Set discovery conditions (flags, milestones)
3. Configure probability
4. Implement trait effects
5. Test discovery and application

---

**Load full documentation:**

```bash
# Core trait systems
cat .claude/docs/systems/epigenetictraits.md
cat .claude/docs/systems/epigenetictraitflagsystem.md

# Advanced systems
cat .claude/docs/systems/ultrarareexotictraits.md
cat .claude/docs/systems/longtermtrait.md

# Implementation details
cat .claude/docs/systems/advancedepigenetictraitsystem.md
```
