# Training System Documentation

**Skill:** `/training-system`
**Purpose:** Load training mechanics and progression documentation

---

## When to Use This Skill

Invoke this skill when:

- Implementing training endpoints
- Working on stat progression algorithms
- Debugging training cooldowns
- Understanding discipline validation
- Working with age restrictions

---

## Quick Training Overview

### Core Mechanics

- **Global Cooldown:** 7-day cooldown per discipline
- **Age Restrictions:** Horses must be 3+ years old
- **Stat Progression:** Discipline-specific stat gains
- **Health Checks:** Injured horses cannot train
- **Ownership Validation:** Only owners can train their horses

### Key Training Rules

```javascript
// Training requirements
- Horse must be 3+ years old
- Horse cannot be injured
- 7-day cooldown per discipline (global across all horses)
- Valid discipline required
- Owner-only access
```

---

## Documentation Locations

### Full Training Documentation

```bash
# Training system mechanics
cat .claude/docs/systems/training-system.md

# Discipline definitions
cat .claude/docs/systems/disciplines.md
```

### API Implementation

- Training endpoints: `backend/routes/trainingRoutes.mjs`
- Training controller: `backend/controllers/trainingController.mjs`
- Training model: `backend/models/trainingModel.mjs`

---

## Key Concepts

### Stat Progression Algorithm

```javascript
// Stat gains per training session
{
  "dressage": { "agility": +2, "balance": +3, "precision": +2 },
  "jumping": { "speed": +2, "boldness": +3, "strength": +2 },
  "racing": { "speed": +3, "stamina": +3, "focus": +2 },
  // ... more disciplines
}
```

### Global Cooldown System

- One discipline per week limit
- Prevents stat stacking
- Enforces strategic training choices
- Cooldown tracked server-side

### Discipline Validation

- Only valid disciplines accepted
- Discipline-appropriate stat gains
- Age-appropriate training intensity

---

## Common Tasks

### Implementing New Training Feature

1. Load `/training-system` skill
2. Review training mechanics documentation
3. Understand cooldown enforcement
4. Implement with proper validation
5. Write tests following balanced mocking

### Debugging Training Issue

1. Check age requirements
2. Verify cooldown calculation
3. Review discipline validation
4. Check ownership verification
5. Validate stat gain calculations

---

**Load full documentation:**

```bash
cat .claude/docs/systems/training-system.md
cat .claude/docs/systems/disciplines.md
```
