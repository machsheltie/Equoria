## GROOM RETIREMENT, REPLACEMENT & TALENT SYSTEM – EXPANSION MODULE

### 🌱 Overview

This module defines mechanics for **groom aging, retirement, talent development, and replacement**, integrating narrative flavor with long-term stable management. It introduces meaningful staff turnover, personality evolution, and potential mentor-legacy systems. Features are modular and designed to enhance gameplay realism and progression.

This file provides a complete, implementation-ready plan for use in AugmentCode with **explicit schema changes, logic paths, and UI integration.**

---

## 1. 🧓 GROOM RETIREMENT SYSTEM

### ✅ Purpose

Simulate natural groom lifecycle and staff turnover to:

- Encourage stable planning
- Create opportunities for new talent
- Increase player investment in skilled grooms

### ✅ Retirement Triggers **COMPLETE**

- ✅ Automatic at `careerWeeks >= 104` (2 years)
- ✅ Early retirement if:
  - ✅ Groom reaches level 10
  - ✅ Assigned to 12+ horses
  - ⏳ Forced by narrative event (e.g., injury or burnout system — optional future feature)

### ✅ Schema Updates **COMPLETE**

```ts
✅ ALTER TABLE grooms ADD COLUMN careerWeeks INTEGER DEFAULT 0;
✅ ALTER TABLE grooms ADD COLUMN retired BOOLEAN DEFAULT false;
✅ ALTER TABLE grooms ADD COLUMN retirementReason TEXT;
✅ ALTER TABLE grooms ADD COLUMN retirementTimestamp TIMESTAMP;
```

### ✅ Weekly Logic **COMPLETE**

- ✅ Each Monday, increment `careerWeeks` by 1 for all active grooms
- ✅ Check for retirement criteria and set `retired = true` if met
- ⏳ Optional: schedule a 1-week notice event ("Your groom Mira is preparing to retire…") **FRONTEND**

### 🎨 UI Display

- “Retiring Soon” tag appears on groom card
- Retired grooms remain in roster (grayed out)
- Add button: “Send off with honors” → opens flavor dialog

### ✅ Implicit Instructions **COMPLETE**

- ✅ Retired grooms cannot be assigned (validation in place)
- ⏳ Cannot hire over max stable limit unless a groom has retired **FRONTEND LOGIC**
- ✅ Remove retired grooms from random hiring pool (filtered in queries)

---

## 2. 🔄 GROOM REPLACEMENT SYSTEM

### ✅ Purpose

Ensure player stables can bring in new talent while preserving past investment

### 📋 Options

#### A. Manual Hiring (default)

- Player selects from 3 randomly generated grooms with:
  - Personality
  - Starting skill levels (based on stable level)
  - Visible quirks (if applicable)

#### B. Legacy Replacement

- If a retired groom reached level 7+:
  - Generate a new groom labeled “Protégé of [Name]”
  - Inherit one of the mentor’s perks or synergy boosts
  - Slight bonus to bonding or milestone shaping

### ✅ Schema **COMPLETE**

```ts
✅ CREATE TABLE groomLegacyLog (
  ✅ id SERIAL PRIMARY KEY,
  ✅ retiredGroomId INTEGER REFERENCES grooms(id),
  ✅ legacyGroomId INTEGER REFERENCES grooms(id),
  ✅ inheritedPerk TEXT,
  ✅ mentorLevel INTEGER,
  ✅ createdAt TIMESTAMP
);
```

### 🎨 UI Integration

- In hiring UI: “Legacy Protégé Available” banner if eligible
- Tooltip: “This groom was trained by [retired name] and inherits one of their trait bonuses.”

### 🧾 Implicit Instructions

- Legacy groom is only offered once per retirement
- Traits inherited randomly from groom's unlocked perk pool
- Legacy perks capped at +1 minor bonus

---

## 3. 🌿 GROOM TALENT TREE SYSTEM

### ✅ Purpose

Give players deeper control and identity customization of groom roles

### ✅ Tree Structure **COMPLETE**

- ✅ Branches tied to personality:
  - ✅ Calm → Soothing, Introspective, Confidant
  - ✅ Energetic → Enthusiast, Adventurer, Motivator
  - ✅ Methodical → Analyst, Handler, Strategist

✅ Each tree has:

- ✅ 3 tiers
- ✅ 2–3 perk choices per tier
- ✅ 1 active at a time per tier

### ✅ Schema **COMPLETE**

```ts
✅ CREATE TABLE groomTalentSelections (
  ✅ id SERIAL PRIMARY KEY,
  ✅ groomId INTEGER REFERENCES grooms(id),
  ✅ tier1 TEXT,
  ✅ tier2 TEXT,
  ✅ tier3 TEXT
);
```

### ✅ Sample Perks by Branch **COMPLETE**

| Personality | Tier | Talent         | Effect                           | Status |
| ----------- | ---- | -------------- | -------------------------------- | ------ |
| Calm        | 1    | Gentle Hands   | +5% bond gain                    | ✅     |
| Calm        | 2    | Empathic Sync  | Reduced stress in reactive foals | ✅     |
| Energetic   | 1    | Playtime Pro   | +10% milestone variety score     | ✅     |
| Energetic   | 2    | Fear Buster    | +15% bravery flag chance         | ✅     |
| Methodical  | 1    | Data Driven    | +5% trait shaping accuracy       | ✅     |
| Methodical  | 2    | Memory Builder | Adds synergy faster              | ✅     |

### 🎨 UI Requirements

- Add “Talent Tree” tab to groom profile
- Selectable upgrades with tooltips and visual progression bar
- Require `level >= 3` to unlock Tier 1, `level 5` for Tier 2, `level 8` for Tier 3

### 🧾 Implicit Instructions

- Talent selections stored permanently
- Choices locked in once selected (no respec unless admin override)
- Perks apply passively once chosen, integrate into milestone + bonding logic

---

## ✅ Final Developer Checklist

- [x] Add retirement logic & UI (**BACKEND COMPLETE** - Frontend UI pending)
- [x] Implement legacy replacement with schema support (**COMPLETE**)
- [x] Define and store talent tree data (**COMPLETE**)
- [x] Integrate perk logic into trait scoring (**COMPLETE**)
- [ ] Update grooming dashboard with talent + retirement status (**FRONTEND ONLY**)

---

## 🌌 Future Expansion Ideas

- Narrative retirement events or endings (e.g., "Mira opens her own training barn")
- Player-built groom academy to train new hires
- Groom-to-groom mentorship and rivalry flavor text

---

### ✨ END OF MODULE
