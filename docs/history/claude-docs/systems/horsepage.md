# 🐴 Horse Profile Overview – Equoria

This document outlines the full expected structure of each individual horse’s profile in the Equoria game. All values, traits, stats, and visual displays must follow the structure below. This page is used by players to view their horse’s current condition, training progress, traits, competition history, and breeding information.

---

## 📋 Basic Info

- **Name** – Display name of the horse.
- **Age** – Age in years; foals age weekly (0–3 are pre-training).
- **Sex** – Mare, Stallion, or Gelding.
- **Breed** – From supported breed list.
- **Color** – Genetically determined color based on genotype.
- **Markings** – Face and leg markings (blaze, stockings, etc.).
- **Image/Portrait** – Horse's rendered image based on genotype and breed.
- **Owner** – Username of player who owns the horse.
- **Stable** – Linked to the stable profile.
- **Genotype** – Number of generations since foundation. 

---

## 🧬 Genetics & Inheritance

- **Genotype** – Stored as gene pairs (e.g., `Ee/aa/CrnCr`), determines phenotype.
- **Phenotype** – Visible traits derived from genotype.
- **Inherited Traits** – Includes epigenetic traits, conformation scores, and temperament passed from parents.

---

## 📊 Stats (No max)

Each horse has an unlimited scale for core stats. These influence training, performance, and competition.

- **Speed**
- **Strength**
- **Stamina**
- **Agility**
- **Endurance**
- **Intelligence**
- **Focus**
- **Precision**
- **Flexibility**
- **Obedience**

Stat values can be affected by:
- Training
- Competition performance
- Temperament modifiers
- Epigenetics
- Rider compatibility

---

## 🧠 Temperament Traits

Temperament types are personality-based and influence training response, competition behavior and rider compatibility.

List of possible traits:
- Calm
- Nervous
- Bold
- Timid
- Curious
- Independent
- Affectionate
- Sensitive
- Spirited
- Steady
- Reactive
- Stubborn
- Lazy
- Playful
- Aggressive

---

## 🧬 Epigenetic Traits

See the Epigenetic_Traits.md file for full descriptions, stacking rules, and effects. 
These traits develop through early-life experience or stressors. Some are inherited.
Traits include:

- **Secretive**
- **Explorative**
- **Desensitized**
- **People-Oriented**
- **Routine-Dependent**
- **Stress-Prone**
- **Confident**
- **Fearful**
- **Easily Overwhelmed**
- **Resilient**
- **Show Calm**
- **Crowd Ready**
- **Injury Prone**
- **Burnout Immune**
- **Presentation Boosted** (temporary)
- **Epigenetic Edge** (hidden)

---

## 💪 Conformation Scores (1-100)

Each body region is scored on a scale from 1 to 100. These affect breeding value and conformation events.

- Head
- Neck
- Shoulders
- Back
- Legs
- Hooves
- Topline
- Hindquarters

These influence success in conformation shows and breeding value.

---

## 🐾 Gaits (1-100)

Each gait is scored on a scale from 1 to 100.

- Walk
- Trot
- Canter
- Gallop
- Special gait (for gaited breeds only)

Each gait can have quality ratings or be flagged for irregularities.

---

## 🎯 Training & Discipline

### Training History:
- Discipline trained in
- Date of training
- Stat gains

Field               Description
trainingCooldowns  Discipline-specific cooldowns (7 days)
trainingHistory    Log of date, discipline, and XP/stat result
riderAssigned      Assigned rider (required for training/competing)

### Assigned Training Discipline (1 active at a time):
- E.g., Show Jumping, Reining, Dressage

Cooldowns prevent over-training. Each discipline gives +5 to its relevant stats weekly.

Discipline	Primary	Secondary	Tertiary	Notes
Western Pleasure	Obedience	Focus	Precision	Precision replaces Balance
Reining	Precision	Agility	Focus	No change
Cutting	Agility	Strength	Intelligence	Logical physical + tactical skills
Barrel Racing	Speed	Agility	Stamina	Stamina replaces Boldness
Roping	Strength	Precision	Focus	Realistic upper-body + aim
Team Penning	Intelligence	Agility	Obedience	Solid trio
Rodeo	Strength	Agility	Endurance	Boldness → Endurance
Hunter	Precision	Endurance	Agility	Balance → Agility
Saddleseat	Flexibility	Obedience	Precision	Balanced change
Endurance	Endurance	Stamina	Speed	All endurance-appropriate
Eventing	Endurance	Precision	Agility	Boldness → Agility
Dressage	Precision	Obedience	Focus	No change
Show Jumping	Agility	Precision	Intelligence	Boldness replaced
Vaulting	Strength	Flexibility	Endurance	Keeps vault realism
Polo	Speed	Agility	Intelligence	No change
Cross Country	Endurance	Intelligence	Agility	Boldness removed cleanly
Combined Driving	Obedience	Strength	Focus	Strong and responsive
Fine Harness	Precision	Flexibility	Obedience	Balanced
Gaited	Flexibility	Obedience	Focus	No change
Gymkhana	Speed	Flexibility	Stamina	Realistic, fast agility
Steeplechase	Speed	Endurance	Stamina	Boldness → Stamina
Racing	Speed	Stamina	Intelligence	Intelligence replaces Balance
Harness Racing	Speed	Precision	Endurance	Great hybrid combo
---

## 🧑‍🤝‍🧑 Assigned Staff

- **Rider** – Required for competitions. Riders have compatibility ratings and strengths.
- **Groom** – Affects bond, burnout resistance, and development.

---

## ❤️ Bonding System

Bond score influences:
- Training success
- Burnout resistance
- Competition nerves

Traits like “People-Oriented” or “Secretive” alter bond speed.

---

## 🏆 Competition History

- Shows entered
- Placement (1st, 2nd, etc.)
- XP or stat gains
- Date of competition

Field               Description

recentResults      Last weeks competitions (discipline, date, result, XP/stat gain)
totalEarnings      Cumulative prize money
disciplinesTrained     List of disciplines horse has trained in

Includes bonuses like:
- `+1 stamina`
- `Burnout triggered` or `Burnout prevented`

---

## 🧾 Pedigree

- Sire, Dam (clickable links)
- Grandparents (optional)
- Trait inheritance map
- Legacy score contribution (planned)

---

## 🩺 Health

Injury chance and performance penalty scale based on health level. Health is affected by weekly vet care and stress events.

- Current Health (One of: Excellent, Very Good, Good, Fair, Poor)
- Vet visit log
- Injury status (flags Injury Prone modifier)
- Burnout status

---

## 🎽 Tack / Inventory

- Tack equipped (Saddle, Bridle, Boots)
- Cosmetic items (e.g., ribbons, halters)
- Recently used items (affects Presentation Boosted flag)

---

## 🛠️ Status Flags & Cooldowns

- **Is Retired** – true/false
- **Is For Sale** – true/false
- **Cooldown Timers**:
  - Training cooldown
  - Competition cooldown
  - Bonding event timer
  - Stud/Brood availability (for breeding)

---

## 🧪 Development Phase (0–3 years)

Displays progress through foalhood:
- Grooming and early training milestones
- Traits unlocked via early experience
- Socialization and desensitization tasks

---

## 🔒 Hidden Traits / Unlockables

Some horses may carry hidden traits:
- `Epigenetic Edge`
- Undiscovered modifiers
- Rare coat genetics (hidden genes)

---

## 🎖️ Legacy & Achievements (Planned)

- Legacy Score contribution
- Hall of Legends status
- Breed Prestige Registry data


## Foalhood Traits (if bred)

Field                   Description
early_handling_log      Tasks completed from foalhood to age 3
trait_exposure_flags    Internal flags triggering epigenetic effects


## Special Tags and Modifiers
Boolean and dynamic flags that influence game outcomes.
presentationBoosted: true/false
burnoutImmune: true/false
injuryProne: true/false
bonded: true/false
epigeneticEdge: true/false