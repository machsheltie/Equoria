---
type: 'agent_requested'
description: 'Groom progression personality'
---

## GROOM PROGRESSION & PERSONALITY UI MODULE – IMPLEMENTATION PLAN

### 🔍 Overview

This module enhances the groom system by introducing **visible personality feedback**, **experience-based leveling**, **synergy tracking**, and a persistent **profile card UI**. These features build narrative depth, improve gameplay clarity, and provide the foundation for long-term progression and specialization.

This plan is written for use with AugmentCode in VS Code and includes **explicit, step-by-step instructions** to integrate into the existing trait and milestone system.

---

## 1. 🧬 GROOM PERSONALITY DISPLAY

### ✅ Purpose

Currently, groom personality types are stored (e.g., `Calm`, `Affectionate`) but not shown to the player.

### 🛠️ Tasks

- [x] Add `personality` field to `GET /grooms/:id/profile` response
- [x] Display groom personality type on:
  - [x] Groom assignment modal
  - [x] Groom card on dashboard
  - [ ] Horse profile if groom is assigned

### 🧾 Implicit Instructions

- Personality value is stored as a string (e.g., "Calm")
- Style with tooltip: "This groom is naturally calm. They work well with reactive or spirited foals."
- Add icon and color tag based on personality (e.g., Calm = blue, Energetic = orange)

---

## 2. 🎖️ GROOM LEVELING SYSTEM

### ✅ Purpose

Grooms should progress with use. Their skill at bonding, training, or show handling should improve over time.

### 🛠️ Schema

```ts
ALTER TABLE grooms ADD COLUMN experience INTEGER DEFAULT 0; ✅ COMPLETED
ALTER TABLE grooms ADD COLUMN level INTEGER DEFAULT 1; ✅ COMPLETED
```

### 📈 Leveling Rules

- Grooms gain XP every time they:
  - Complete a milestone window while assigned → +20 XP
  - Successfully shape a trait → +10 XP
  - Win a conformation show while handling → +15 XP
- XP required per level: `100 * level`
- Level cap: 10 (adjustable)

### 🎯 Skill Scaling

- Each level adds:
  - +1 to bonding skill (max 10)
  - +1% chance to enhance trait outcome (cumulative)

### 🧾 Implicit Instructions

- Add `experience` and `level` to `GET /grooms/:id/profile`
- Display XP bar on groom cards
- Update logic engine to factor `level` into trait scoring system

---

## 3. 🤝 GROOM–HORSE SYNERGY SYSTEM

### ✅ Purpose

Track long-term relationship quality beyond bond score. A synergy rating increases based on familiarity and compatibility.

### 🛠️ Schema

```ts
CREATE TABLE groomHorseSynergy ( ✅ COMPLETED
  id SERIAL PRIMARY KEY,
  groomId INTEGER REFERENCES grooms(id),
  horseId INTEGER REFERENCES horses(id),
  synergyScore INTEGER DEFAULT 0,
  sessionsTogether INTEGER DEFAULT 0,
  lastAssignedAt TIMESTAMP
);
```

### 🧮 Synergy Gain Logic

- +1 per milestone completed together
- +2 for trait shaped while assigned
- +3 for rare/exotic trait influenced
- -5 if groom is reassigned before milestone ends

### ⚡ Synergy Effects

- At 25 synergy → +5% bond growth
- At 50 synergy → +1 to milestone trait modifier
- At 100 synergy → unlock minor cosmetic bonus (e.g., nameplate)

### 🧾 Implicit Instructions

- Update synergy score after each milestone audit
- Include synergy data in `GET /horses/:id/groomStatus` and `GET /grooms/:id/assignedHorses`
- Optional: add synergy badges/indicators in UI

---

## 4. 📋 GROOM ASSIGNMENT HISTORY

### ✅ Purpose

Players should see where grooms have been and what they’ve accomplished.

### 🛠️ Schema

```ts
CREATE TABLE groomAssignmentLog ( ✅ COMPLETED
  id SERIAL PRIMARY KEY,
  groomId INTEGER REFERENCES grooms(id),
  horseId INTEGER REFERENCES horses(id),
  assignedAt TIMESTAMP,
  unassignedAt TIMESTAMP,
  milestonesCompleted INTEGER,
  traitsShaped TEXT[],
  xpGained INTEGER
);
```

### 🧾 UI/Logic Integration

- Add tab in groom profile: “Assignment History”
- Each row = horse name, duration assigned, traits affected, XP earned
- Add audit hooks in milestone system to log assignment performance

---

## 5. 📚 GROOM HANDBOOK / PROFILE CARD

### ✅ Purpose

Create a consistent UI component that presents all data about a groom at a glance.

### 🧾 UI Sections

- Avatar and name
- Personality type
- Skill ratings (bonding, foal shaping, show handling)
- Perk traits (revealed over time)
- Level + XP bar
- Assigned horses list
- Recent milestones or trait outcomes
- Assignment history tab

### 🧾 Implicit Instructions

- Use `GET /grooms/:id/profile` to power the card
- Display on click from dashboard or stable UI
- Personality quirks (e.g., "Has a soft spot for spirited foals") shown only after level 3

---

## ✅ FINAL CHECKLIST FOR AUGMENT

- [x] Add personality display to UI
- [x] Implement XP and leveling system with database support
- [x] Add synergy tracking table and logic hooks
- [x] Log assignment history with trait/XP outcome
- [ ] Build persistent groom profile UI card

---

## 🌱 Future Expansion Ideas

- Add groom “Talent Trees” based on personality + usage
- Seasonal or limited-edition grooms with unique lore/bonuses
- Groom retirement/replacement mechanics + lineage

---

---

## 📊 IMPLEMENTATION STATUS SUMMARY

### ✅ COMPLETED BACKEND FEATURES

- **Groom XP & Leveling System**: Full implementation with database schema, service layer, and API endpoints
- **Synergy Tracking**: Complete groom-horse synergy system with effects calculation
- **Assignment History**: Full logging system with milestone and trait tracking
- **Personality Effects**: Comprehensive personality-based bonuses and trait influence
- **Database Schema**: All required tables (grooms.experience, grooms.level, groomHorseSynergy, groomAssignmentLog)
- **API Endpoints**: Complete `/grooms/:id/profile` with personality data
- **Service Layer**: groomProgressionService.mjs with all progression mechanics
- **Testing**: 100% passing tests for all progression features

### ✅ COMPLETED FRONTEND FEATURES

- **Personality Display**: Groom personality badges in assignment modals and cards
- **Groom Assignment UI**: Complete assignment interface with personality indicators
- **Skill Level Display**: Color-coded skill level indicators
- **Specialty Icons**: Visual specialty indicators for grooms

### ❌ REMAINING TASKS (Frontend Only)

- **Groom Profile Card**: Persistent UI component showing:
  - XP bar and level display
  - Synergy records with horses
  - Assignment history tab
  - Personality quirks (unlocked at level 3+)
- **Horse Profile Integration**: Show assigned groom personality on horse profiles
- **XP/Level Visualization**: Progress bars and level-up notifications
- **Synergy Effects Display**: Visual indicators for synergy bonuses

### 🎯 NEXT STEPS

All backend functionality is complete and tested. The remaining work is purely frontend UI development to display the existing data in user-friendly components.

### ✨ END OF MODULE
