# POST-MILESTONE TRAIT VALIDATION LOGIC – ADVANCED TRAIT MODULE

### 🔍 Overview

This module defines the **Post-Milestone Trait Validation System**, which performs a secondary check after standard milestone evaluations to determine if a foal qualifies for ultra-rare or exotic traits. Unlike ordinary traits, these require hidden combinations of grooming history, bond behavior, environmental factors, or lineage to be met. This system ensures dynamic and emergent gameplay while maintaining trait rarity.

---

### ⏰ Execution Timing

- Runs **immediately after** standard milestone evaluation and trait assignment.
- Operates as a **background audit system** — does not override assigned traits but may **append** additional rare or exotic traits.

---

### 📚 System Purpose

- Validate eligibility for ultra-rare or exotic traits based on:
  - Groom presence, bond streaks, or absences
  - Stress events or novelty exposures
  - Trait lineage from parents
  - Milestone task and care history
- Trigger assignment of **rare traits** if all conditions are met
- Maintain trait rarity while adding discoverable depth

---

### 🔢 Required Inputs (per audit cycle)

- `horseId`
- `milestoneType` (e.g., Socialization, Trust, etc.)
- `milestoneWeek`
- `foalAge`
- `temperament`
- `groomId`
- `bondScoreWindow[]`
- `stressEvents[]`
- `noveltyEvents[]`
- `missedTasks[]`
- `parentTraitSummary[]`

---

### 📊 Audit Flow Pseudocode

```ts
function runPostMilestoneTraitAudit(horseId, milestoneData) {
  const auditContext = buildAuditContext(horseId, milestoneData);

  for (const trait of rareTraitDefinitions) {
    if (trait.trigger === 'milestoneAudit' && matchesConditions(auditContext, trait.conditions)) {
      assignRareTrait(horseId, trait.name, {
        source: 'postMilestone',
        milestoneType: milestoneData.type,
        groomId: auditContext.groomId,
        bondScoreAvg: auditContext.bondAvg,
        stressScoreAvg: auditContext.stressAvg,
      });
    }
  }
}
```

---

### 🧬 rareTraitDefinitions – JSON Structure

```json
{
  "name": "Stormtouched",
  "trigger": "milestoneAudit",
  "conditions": {
    "temperament": "Reactive",
    "noveltyEvent": true,
    "missedTasks": ["desensitization"],
    "stressAvg": { "gt": 60 },
    "bondAvg": { "lt": 40 }
  },
  "mechanicalEffects": ["doubleStatGain", "stressVulnerability"],
  "rarity": "exotic"
}
```

---

### 🚀 Trait Assignment Function

- Append trait to `horses.traits` array
- Insert record into `traitHistoryLog` with `sourceType: 'postMilestone'`
- Trigger in-game notification and unlock discovery if not yet revealed

---

### ⚖️ Rules & Validation

- Traits **must not conflict** with any already assigned milestone trait
- Audit checks run only **once per milestone week**
- If multiple rare traits are valid, assign **only one**, prioritizing higher rarity first
- Traits added through audit do **not reroll** existing ones
- Trait must not already exist on the horse

---

### 🎨 UI Feedback

- Notification: "⚡ A hidden trait has emerged! Stormtouched assigned after Week 2."
- Visual: Rare trait badge glows or animates into trait card
- Lore UI: Display audit source and discovery milestone in tooltip

---

### 🔏 Admin & Debugging Hooks

- `/debug/forceTraitAudit/:horseId` → manually re-run audit
- Add `traitAuditPreview` in admin panel to visualize candidate traits
- Enable forced trait reveal (for dev/testing)

---

### ✨ Implicit Instructions

- This system runs **after** and independently of standard trait assignment
- Audit context is **derived from actual gameplay data**, not simulated
- Rare traits are only added if conditions match exactly — no fuzzy logic
- All new traits from audit must be **logged** with origin tag = `postMilestone`
- Trait assignment must trigger all associated systems (stat gain, UI, breeding flags)

---

### 🌐 Future Expansion

- Add post-training trait audits (e.g., after first event or injury)
- Add lineage flag audit to trigger multi-generational rare trait chains
- Enable seasonal or environmental rare triggers (e.g., “born during eclipse”)

---

### ✨ END OF MODULE
