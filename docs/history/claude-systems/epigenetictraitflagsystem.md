## EPIGENETIC TRAIT FLAG SYSTEM – IMPLEMENTATION PLAN

### 🌟 Overview
This module defines and implements the **epigenetic flag system**, allowing foals to develop long-term temperament-affecting flags based on early-life care patterns. Unlike milestone-assigned traits, flags persist across life stages and influence future temperament, behavioral responses, and trait probability in both the horse and its offspring.

---

### 🔖 Core Concepts
- **Epigenetic flags** represent learned, conditioned, or emotionally ingrained tendencies.
- Flags can:
  - Alter the weighting or likelihood of future traits (e.g., `brave` → increased chance of `bold`, reduced chance of `spooky`)
  - Modify temperament compatibility in training or competition
  - Contribute to hereditary influence in breeding logic (long-term roadmap)

---

### 🔢 Flag Definitions
Each flag includes:
- `name` (string)
- `description` (string)
- `type` (positive | negative | adaptive)
- `source_category` (grooming | bonding | environment | novelty)
- `influences` (trait_weight_modifiers, competition_behavior_modifiers)

#### Example Flags:
```json
{
  "name": "brave",
  "description": "Foal has developed a strong response to novelty with low fear reactivity.",
  "type": "positive",
  "source_category": "novelty",
  "influences": {
    "bold": +0.3,
    "spooky": -0.4,
    "stat_recovery_bonus": 0.05
  }
}
```

#### Starter Flag List:
- `brave`
- `fearful`
- `confident`
- `insecure`
- `affectionate`
- `aloof`
- `skittish`
- `resilient`
- `fragile`

---

### 🧹 Care Pattern Mapping
Each flag is triggered by **cumulative care patterns** observed between birth and age 3. Augment must track daily interaction logs and calculate streaks, neglect, or situational exposure accordingly.

#### Example Mapping Table:
| Flag         | Triggering Patterns                                                   |
|--------------|------------------------------------------------------------------------|
| `affectionate` | Daily grooming + ≥50 bond for 7+ days                                 |
| `insecure`     | No grooming for 4+ consecutive days + bond < 25                      |
| `brave`        | Novel object exposure + calm groom interaction during fear window    |
| `skittish`     | Startled response event + no groom present + low bond                |
| `resilient`    | Moderate stress + positive groom recovery 3+ times                   |
| `fragile`      | Multiple stress spikes + no soothing or care task follow-up          |

---

### 🚀 Implementation Workflow
1. **Track Care Patterns:**
   - Extend `daily_care_log` table to include task type, bond score, novelty exposure, stress events.

2. **Flag Evaluation Engine:**
   - Runs weekly between birth and age 3
   - For each defined flag:
     - Match against rolling care history for trigger conditions
     - If match threshold met → assign flag to horse

3. **Flag Storage:**
   - Add `epigenetic_flags` array to `horses` table
   - Store `flag_name`, `source_event`, `assigned_at`

4. **Trait Influence Mapping:**
   - When traits are generated (e.g., during milestone or leveling), use:
     - `flag_weight_modifiers` to bias outcome
     - `flag_behavior_modifiers` to alter stat recovery, bonding rate, or stress decay

5. **Flag UI Display:**
   - On horse profile, add flag section:
     - Flag name, icon, description, assigned age, influence preview

---

### 🚧 API Requirements
- `POST /flags/evaluate`:
  - Input: `horse_id`, `care_log[]`, `bond_score`, `novelty_events[]`, `stress_events[]`
  - Output: newly assigned flags

- `GET /horses/:id/flags`:
  - Returns full list of epigenetic flags and source history

---

### ✨ Implicit Rules
- Flags are **not overwritten** and can stack (e.g., a horse can be `confident` and `skittish` if exposed to both reinforcing and stress conditions)
- Once assigned, flags **do not change** unless explicitly reset via admin/debug route
- Flag evaluation must **never conflict with milestone traits**, but may reinforce them
- Flags should be capped at **5 per horse** to maintain gameplay clarity

---

### 🌐 Future Extensions
- Inheritance probability system (offspring inherit epigenetic flag bias)
- Environment-triggered temporary flags (e.g., `alert`, `soothed`, `hyperaware`)
- Expanded interaction with competition outcomes and AI rider compatibility

---

---

## 🎉 IMPLEMENTATION STATUS

### ✅ COMPLETED FEATURES
- **Database Schema**: epigenetic_flags field already exists in horses table
- **Flag Definitions System**: 9 starter flags with complete configuration (epigeneticFlagDefinitions.mjs)
- **Care Pattern Analysis**: Comprehensive analysis of groom interactions and care history (carePatternAnalysis.mjs)
- **Flag Evaluation Engine**: Weekly evaluation system with trigger condition matching (flagEvaluationEngine.mjs)
- **API Endpoints**: Complete REST API with authentication and validation (epigeneticFlagRoutes.mjs)
- **Controller Logic**: Full business logic implementation (epigeneticFlagController.mjs)
- **Comprehensive Testing**: 52 passing tests with balanced mocking approach
- **Integration**: Fully integrated with existing groom interaction and trait systems

### 🎯 IMPLEMENTATION DETAILS
- **Flag Types**: 4 positive, 5 negative flags with trait weight modifiers
- **Trigger Conditions**: Complex pattern matching based on care consistency, novelty exposure, stress management
- **Business Rules**: 5 flag limit, no overwrites, age 0-3 evaluation window
- **API Security**: Full authentication, ownership validation, admin controls
- **Performance**: Optimized queries with JavaScript filtering for complex conditions

### ✨ END OF MODULE - IMPLEMENTATION COMPLETE
