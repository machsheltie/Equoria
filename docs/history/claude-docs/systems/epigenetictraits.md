# 🧬 Equoria Epigenetic Traits System

Epigenetic traits reflect developmental influences that shape a horse's behavior, performance, and adaptability. These traits are **not static** — they emerge based on **foalhood experiences**, **early training**, **bonding**, and **environmental exposure**.

---

## 📋 Trait Table

| Trait Name              | Type                | Description                                                                 |
|------------------------|---------------------|-----------------------------------------------------------------------------|
| `secretive`            | Epigenetic          | Slower to bond or reveal strengths. Rider compatibility and stat potential are harder to detect. |
| `explorative`          | Epigenetic          | Highly curious. Gains bonuses in exploration-based or trail events.        |
| `desensitized`         | Epigenetic          | Lower fear response to spooky stimuli (flags, noise, crowds).              |
| `peopleOriented`      | Epigenetic          | Bonds quickly with grooms and riders. Improved trust and faster XP gain.   |
| `routineDependent`    | Epigenetic          | Performs best under consistent care/training routines. Penalized by chaos or frequent changes. |
| `stressProne`         | Epigenetic          | More vulnerable to negative reactions under unpredictable or overstimulating conditions. |
| `confident`    | Epigenetic          | Gains bonus XP during training or education activities.                    |
| `resilient`            | Epigenetic          | Faster recovery from stress, burnout, injury, or travel disruption.        |
| `showCalm`            | Epigenetic          | Stands well for judging, grooming, and formal presentation.                |
| `crowdReady`          | Epigenetic          | Comfortable in loud or visually busy environments (e.g., parades, galas). |
| `injuryProne`         | Epigenetic/Temporary| Increased injury risk from poor care or genetics. May fade over time with rehabilitation. |
| `burnoutImmune`       | Dynamic (Earned)    | Prevents burnout even under intense workloads. Earned through sustained proper care. |
| `presentationBoosted` | Temporary           | Cosmetic bonus from recent grooming or item use. Temporary score boost.    |
| `epigeneticEdge`      | Hidden              | Quiet scoring/training bonus earned by meeting ideal foalhood conditions. Hidden unless revealed. |

---

## 📈 How Traits Are Gained

Traits develop during a horse’s **early life (0–3 years)** and are influenced by care patterns, training types, stress levels, and socialization. They may be:

- **Unlocked automatically** when certain conditions are met
- **Hidden at first** and only revealed through bonding or evaluations
- **Earned dynamically** as the horse performs or matures

### 🚼 Early Life Influence Windows

| Age Range | Influences | Potential Traits |
|-----------|------------|------------------|
| 0–1 yr    | Socialization, desensitization, foal handling | `people_oriented`, `desensitized`, `secretive` |
| 1–2 yrs   | Routine care, curiosity, play | `explorative`, `routine_dependent`, `stress_prone` |
| 2–3 yrs   | Structured training, bonding, exposure to events | `confident_learner`, `resilient`, `crowd_ready`, `show_calm` |

---

## 🧠 Stacking Rules

- **Maximum of 3 visible epigenetic traits** at a time per horse
- **1 hidden trait slot** exists (`epigenetic_edge`, revealed by analysis or legacy bonus)
- Temporary traits like `presentation_boosted` can overlay epigenetic traits during competition but **do not count toward the limit**
- **Dynamic traits** (`burnout_immune`, `bonded`) exist outside the stack and are gained through gameplay

---

## ⚠️ Trait Conflict Handling

Certain traits conflict with one another. These cannot co-exist:

| Trait A            | Conflicting Trait B      | Rule                                |
|--------------------|--------------------------|-------------------------------------|
| `routine_dependent` | `explorative`             | Only one can be active; temperament check determines winner |
| `secretive`        | `people_oriented`         | Must pick one during bonding phase |
| `stress_prone`     | `resilient`               | Whichever influence dominates more during foalhood is kept |
| `burnout_immune`   | `injury_prone`            | Only one may be active; training care determines override |

---

## 🔒 Hidden Trait: `epigenetic_edge`

If a horse meets **all ideal conditions** during early life (nutrition, bonding, stress minimization, appropriate training):

- The horse gains the hidden trait `epigenetic_edge`
- Provides subtle scoring and stat growth bonuses
- May increase genetic legacy when breeding
- Only revealed through special evaluations (Vet/Lineage/Legacy Report)

---

## 🛠 Implementation Notes

Traits should be stored in JSONB as part of the horse profile

Use time-based triggers or training logs to determine trait unlocks

Dynamic traits (bonded, burnout_immune) must be re-evaluated weekly

Trait flags should be accessible by the competition scoring system and training XP logic

Horse physical stats should now include: speed, strength, stamina, agility, intelligence, focus, endurance, obedience, precision, flexibility

Horse conformation scores should use a 1–100 sliding scale per region

Update confident_learner to confident

Add fearful and easily_overwhelmed as valid epigenetic traits