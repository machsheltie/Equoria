# Game Design Folder

**Purpose**: Game mechanics, features, and systems design for the Equoria horse breeding simulation platform.

**Last Updated**: 2025-01-14

---

## Folder Structure

```
gameDesign/
├── traits/            # Trait system (11 files)
├── systems/           # Core game systems (7 files)
└── features/          # Specific game features (4 files)
```

**Total**: 22 game design documents

---

## Traits System

**Folder**: [traits/](./traits/)

**Purpose**: Epigenetic trait system, modifiers, and rare traits

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [epigeneticTraits.md](./traits/epigeneticTraits.md) | Core epigenetic system | ~800 | Active |
| [advancedEpigeneticTraitSystem.md](./traits/advancedEpigeneticTraitSystem.md) | Advanced mechanics | ~600 | Active |
| [traitModifiers.md](./traits/traitModifiers.md) | Trait modification rules | ~400 | Active |
| [comprehensiveTraitDocumentation.md](./traits/comprehensiveTraitDocumentation.md) | Complete trait reference | ~1,000 | Active |
| [ultraRareExoticTraits.md](./traits/ultraRareExoticTraits.md) | Exotic traits | ~500 | Active |
| [advancedEpigeneticsPlan.md](./traits/advancedEpigeneticsPlan.md) | Implementation plan | ~300 | Planning |
| [epigeneticExpansionPhase2.md](./traits/epigeneticExpansionPhase2.md) | Phase 2 expansion | ~350 | Planning |
| [epigeneticTraitFlagSystem.md](./traits/epigeneticTraitFlagSystem.md) | Flag system | ~250 | Active |
| [longTermTrait.md](./traits/longTermTrait.md) | Long-term effects | ~200 | Active |
| [postMilestoneTraitValidation.md](./traits/postMilestoneTraitValidation.md) | Validation | ~150 | Active |
| [enhancedMilestoneEval.md](./traits/enhancedMilestoneEval.md) | Milestone evaluation | ~180 | Active |

**Total**: 11 files, ~4,730 lines

**Key Concepts**:
- Genetic traits (permanent, inherited)
- Epigenetic traits (modifiable, influenced by care)
- Acquired traits (temporary, from training/events)
- Trait modifiers (bonuses/penalties)
- Ultra-rare exotic traits (special genetics)

---

## Systems Design

**Folder**: [systems/](./systems/)

**Purpose**: Core game systems and mechanics

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [groomSystem.md](./systems/groomSystem.md) | Groom mechanics and progression | ~900 | Active |
| [trainingSystem.md](./systems/trainingSystem.md) | Horse training mechanics | ~700 | Active |
| [competitionSystemsOverview.md](./systems/competitionSystemsOverview.md) | Competition rules | ~600 | Active |
| [riderSystemsOverview.md](./systems/riderSystemsOverview.md) | Rider mechanics | ~500 | Active |
| [groomProgressionPersonality.md](./systems/groomProgressionPersonality.md) | Groom personality system | ~400 | Active |
| [groomPersonalityTraitBonus.md](./systems/groomPersonalityTraitBonus.md) | Personality bonuses | ~300 | Active |
| [groomRetirementReplacement.md](./systems/groomRetirementReplacement.md) | Retirement system | ~250 | Active |

**Total**: 7 files, ~3,650 lines

**Key Systems**:
- Groom hiring, progression, and retirement
- Horse training and skill development
- Competition participation and scoring
- Rider assignment and bonuses

---

## Features Design

**Folder**: [features/](./features/)

**Purpose**: Specific game features and mechanics

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [conformationShows.md](./features/conformationShows.md) | Conformation show mechanics | ~500 | Active |
| [disciplines.md](./features/disciplines.md) | Riding disciplines | ~600 | Active |
| [gameFeaturesOverview.md](./features/gameFeaturesOverview.md) | Feature summary | ~400 | Active |
| [foalEnrichmentSummary.md](./features/foalEnrichmentSummary.md) | Foal enrichment system | ~300 | Active |

**Total**: 4 files, ~1,800 lines

**Key Features**:
- Conformation shows (judging based on breed standards)
- Disciplines (dressage, jumping, racing, etc.)
- Foal enrichment (early development activities)
- Special events and challenges

---

## Game Design Principles

### 1. Depth Over Complexity
- Rich mechanics that are intuitive to learn
- Gradual introduction of advanced concepts
- Clear feedback loops

### 2. Player Agency
- Meaningful choices that impact outcomes
- Multiple viable strategies
- Risk/reward balance

### 3. Long-Term Engagement
- Progression systems (grooms, horses, player)
- Collectible rare traits
- Seasonal events and competitions

### 4. Realism with Fantasy
- Realistic horse breeding genetics
- Gamified trait system
- Magical/exotic trait elements

---

## Core Game Loop

```
1. Breed Horses
   ↓
2. Assign Grooms
   ↓
3. Train & Care
   ↓
4. Develop Traits
   ↓
5. Compete
   ↓
6. Earn Rewards
   ↓
(Repeat with improved genetics/grooms)
```

---

## Progression Systems

### Player Progression
- **Level**: Based on total experience
- **Reputation**: Influenced by competition wins
- **Achievements**: Special accomplishments
- **Collections**: Rare traits, grooms, horses

### Horse Progression
- **Age**: Foal → Yearling → Adult → Senior
- **Training**: Skill development over time
- **Traits**: Epigenetic trait development
- **Competition Record**: Win/loss history

### Groom Progression
- **Level**: 1-20 (experience-based)
- **Skills**: Specialized abilities
- **Personality**: Affects trait bonuses
- **Retirement**: After 10-15 years of service

---

## Economy Design

### Currencies
- **Credits**: Primary currency (buy grooms, enter competitions)
- **Premium Currency**: Special features (cosmetics, boosts)
- **Reputation**: Unlock special events

### Sources
- Competition prizes
- Selling horses
- Daily login rewards
- Achievements

### Sinks
- Groom salaries
- Training costs
- Competition entry fees
- Breeding fees

---

## How to Use This Folder

### Finding Game Design Documentation

**By Topic**:
- Trait system? → [traits/epigeneticTraits.md](./traits/epigeneticTraits.md)
- Groom system? → [systems/groomSystem.md](./systems/groomSystem.md)
- Training? → [systems/trainingSystem.md](./systems/trainingSystem.md)
- Competitions? → [systems/competitionSystemsOverview.md](./systems/competitionSystemsOverview.md)
- Disciplines? → [features/disciplines.md](./features/disciplines.md)

**By Development Phase**:
- Core mechanics (MVP): Groom, training, basic traits
- Phase 2: Advanced traits, competitions
- Phase 3: Special features, exotic traits
- Phase 4: Seasonal events, player vs player

### Creating New Game Design Documentation

1. **Determine category**: traits / systems / features
2. **Use template**:
   ```bash
   cp ../templates/gameDesignFeature.md gameDesign/category/newFeature.md
   ```
3. **Document the feature**:
   - Game design overview
   - Mechanics and rules
   - User experience flow
   - Implementation notes
   - Balance considerations

### Updating Game Design

**When to update**:
- Balance changes
- New mechanics
- Player feedback integration
- Post-launch adjustments

**Update process**:
1. Document proposed changes
2. Review with stakeholders (self-review in solo project)
3. Update relevant documentation
4. Link to implementation plan

---

## Balance Considerations

### Trait Rarity

| Rarity | Probability | Example |
|--------|-------------|---------|
| Common | 70% | Basic speed, stamina |
| Uncommon | 20% | Enhanced learning rate |
| Rare | 8% | Elite genetics |
| Epic | 1.8% | Legendary bloodline |
| Exotic | 0.2% | Mythical traits |

### Groom Impact

**Level 1 Groom**: +5% trait development
**Level 10 Groom**: +25% trait development
**Level 20 Groom**: +50% trait development

### Competition Difficulty

**Local**: Entry-level horses
**Regional**: Trained horses
**National**: Elite horses
**International**: Champions only

---

## Implementation Priority

### Phase 1 (MVP) - Weeks 1-4
- ✅ Basic trait system
- ✅ Groom hiring and assignment
- [ ] Simple training mechanics
- [ ] Basic horse breeding
- [ ] Local competitions

### Phase 2 - Weeks 5-8
- [ ] Advanced trait system
- [ ] Groom progression
- [ ] Training specializations
- [ ] Regional/national competitions
- [ ] Foal enrichment

### Phase 3 - Weeks 9-12
- [ ] Exotic traits
- [ ] Groom retirement system
- [ ] Advanced competitions
- [ ] Special events
- [ ] Player vs player

---

## Related Documentation

- **Architecture**: [../architecture/](../architecture/) - Technical implementation
- **Database**: [../architecture/database/databaseSchema.md](../architecture/database/databaseSchema.md) - Data model
- **Planning**: [../planning/](../planning/) - Implementation roadmap
- **Status**: [../status/](../status/) - Current implementation status

---

## Statistics

**Total Documents**: 22 files
- Traits: 11 files (~4,730 lines)
- Systems: 7 files (~3,650 lines)
- Features: 4 files (~1,800 lines)

**Total Lines**: ~10,180 lines of game design documentation

**Coverage**: All core systems documented

---

**For complete .claude folder documentation, see [../README.md](../README.md)**
