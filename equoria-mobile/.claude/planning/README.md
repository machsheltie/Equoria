# Planning Folder

**Purpose**: Sprint planning, day plans, and implementation strategies for the Equoria project.

**Last Updated**: 2025-01-14

---

## Folder Structure

```
planning/
├── current/           # Active planning documents
│   ├── week1/         # Day 3 plans and strategies
│   ├── week2Plan.md
│   ├── week3Plan.md
│   ├── week4Plan.md
│   ├── deploymentPlan.md
│   ├── nextPhaseDevelopmentPlan.md
│   └── frontendGroomImplementationPlan.md
└── archive/           # Completed plans
    └── week2Old.md
```

---

## Current Plans (Active)

### Week Plans
| File | Purpose | Status |
|------|---------|--------|
| [week2Plan.md](./current/week2Plan.md) | Week 2 objectives and deliverables | Planning |
| [week3Plan.md](./current/week3Plan.md) | Week 3 roadmap | Planning |
| [week4Plan.md](./current/week4Plan.md) | Week 4 planning | Planning |

### Day Plans (Week 1)
| File | Purpose | Status |
|------|---------|--------|
| [day3Plan.md](./current/week1/day3Plan.md) | Day 3 objectives | Complete ✅ |
| [day3ImplementationChecklist.md](./current/week1/day3ImplementationChecklist.md) | Day 3 checklist | Complete ✅ |
| [day3Phase1Strategy.md](./current/week1/day3Phase1Strategy.md) | Phase 1 strategy | Complete ✅ |

### Feature Plans
| File | Purpose | Status |
|------|---------|--------|
| [nextPhaseDevelopmentPlan.md](./current/nextPhaseDevelopmentPlan.md) | Next phase planning | Planning |
| [frontendGroomImplementationPlan.md](./current/frontendGroomImplementationPlan.md) | Groom feature frontend | Planning |
| [deploymentPlan.md](./current/deploymentPlan.md) | Deployment strategy | Planning |

---

## Archive

Plans that have been completed and archived for historical reference.

| File | Purpose | Archived Date |
|------|---------|---------------|
| [week2Old.md](./archive/week2Old.md) | Original Week 2 plan | 2025-01-14 |

---

## How to Use This Folder

### Creating a New Plan

1. **Determine the type**:
   - Week plan: `weekXPlan.md`
   - Day plan: `current/weekX/dayYPlan.md`
   - Feature plan: `featureNameImplementationPlan.md`

2. **Use a template** (from [../templates/](../templates/)):
   ```bash
   cp ../templates/implementationPlan.md current/myNewPlan.md
   ```

3. **Fill in the template**:
   - Update title and metadata
   - Define objectives and deliverables
   - Set timeline and milestones
   - Document success criteria

4. **Link from here**:
   - Add entry to appropriate table above
   - Update status as you progress

### Archiving a Completed Plan

1. **Mark as complete**: Update status in table to "Complete ✅"
2. **Move to archive**:
   ```bash
   mv current/completedPlan.md archive/
   ```
3. **Update this README**: Move entry from Current to Archive section

---

## Planning Best Practices

### Week Plans
- **Create on**: Sunday before the week starts
- **Review on**: Friday afternoon (week retrospective)
- **Update**: Daily standup adjustments
- **Archive**: End of week when complete

### Day Plans
- **Create on**: Evening before the day
- **Review on**: End of day
- **Update**: Throughout the day as tasks complete
- **Keep**: In week folder even after complete (for reference)

### Feature Plans
- **Create on**: Before starting feature development
- **Review on**: After each phase completion
- **Update**: As requirements change
- **Archive**: When feature is deployed to production

---

## Related Documentation

- **Current Status**: [../status/](../status/) - Check implementation status
- **Architecture**: [../architecture/](../architecture/) - Technical design decisions
- **Game Design**: [../gameDesign/](../gameDesign/) - Feature specifications
- **Quick Access**: [../QUICK_REFERENCE.md](../QUICK_REFERENCE.md) - Most accessed files

---

## Statistics

**Current Plans**: 10 files
- Week plans: 3
- Day plans: 3
- Feature plans: 4

**Archive**: 1 file

**Total Lines**: ~4,500 lines of planning documentation

---

**For complete .claude folder documentation, see [../README.md](../README.md)**
