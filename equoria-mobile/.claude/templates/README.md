# Templates Folder

**Purpose**: Documentation templates for creating new files consistently across the Equoria project.

**Last Updated**: 2025-01-14

**Status**: Templates being created

---

## Available Templates

| Template | Purpose | Status |
|----------|---------|--------|
| [gameDesignFeature.md](./gameDesignFeature.md) | Game feature specifications | 📋 Pending |
| [architectureDoc.md](./architectureDoc.md) | Architecture documentation | 📋 Pending |
| [implementationPlan.md](./implementationPlan.md) | Implementation plans | 📋 Pending |
| [statusReport.md](./statusReport.md) | Status reports | 📋 Pending |

**Total**: 4 templates (to be created)

---

## Template Usage

### How to Use Templates

1. **Copy template**:
   ```bash
   cp .claude/templates/gameDesignFeature.md .claude/gameDesign/features/myFeature.md
   ```

2. **Fill in placeholders**:
   - Replace `[FEATURE_NAME]` with your feature name
   - Replace `[DATE]` with current date
   - Fill in all `[SECTION]` placeholders

3. **Customize as needed**:
   - Add/remove sections based on your needs
   - Adjust content to match feature complexity
   - Maintain overall structure

4. **Link from appropriate README**:
   - Add entry to folder's README.md
   - Update quick reference if frequently accessed

---

## Template Details

### Game Design Feature Template

**File**: `gameDesignFeature.md`

**Purpose**: Document new game features and mechanics

**Sections**:
- Feature overview
- User experience flow
- Game mechanics and rules
- Technical requirements
- Balance considerations
- Testing approach
- Implementation notes

**Use for**:
- New game systems (e.g., breeding, competitions)
- New features (e.g., social features, achievements)
- Major gameplay additions

**Example usage**:
```bash
cp templates/gameDesignFeature.md gameDesign/features/breedingMechanics.md
```

---

### Architecture Document Template

**File**: `architectureDoc.md`

**Purpose**: Document technical architecture and design decisions

**Sections**:
- System overview
- Architecture diagram
- Component relationships
- Data flow
- Design decisions and rationale
- Security considerations
- Performance considerations
- Testing strategy

**Use for**:
- New backend services
- Frontend architecture changes
- Database schema updates
- API design

**Example usage**:
```bash
cp templates/architectureDoc.md architecture/backend/paymentService.md
```

---

### Implementation Plan Template

**File**: `implementationPlan.md`

**Purpose**: Plan feature implementation with timeline and tasks

**Sections**:
- Feature summary
- Objectives and success criteria
- Technical approach
- Task breakdown
- Timeline and milestones
- Dependencies and blockers
- Testing plan
- Deployment strategy

**Use for**:
- Sprint planning
- Feature implementation
- Large refactoring efforts
- System migrations

**Example usage**:
```bash
cp templates/implementationPlan.md planning/current/socialFeaturesImplementation.md
```

---

### Status Report Template

**File**: `statusReport.md`

**Purpose**: Create consistent status reports

**Sections**:
- Executive summary
- Achievements
- Test metrics
- Coverage changes
- Technical debt addressed
- Blockers/issues
- Lessons learned
- Next steps

**Use for**:
- Daily technical reviews
- Phase completion summaries
- Weekly status updates
- End-of-sprint reviews

**Example usage**:
```bash
cp templates/statusReport.md status/day5TechnicalReview.md
```

---

## Template Standards

### All Templates Include

**Header Section**:
- Document title
- Purpose statement
- Author/owner
- Date created
- Last updated date
- Status (draft/active/archived)

**Body Sections**:
- Clear section headings
- Placeholder text `[TO BE FILLED]`
- Examples where helpful
- Links to related documentation

**Footer Section**:
- Related documents
- Changelog (for updates)
- Review history

### Formatting Standards

**Markdown**:
- Use `##` for main sections
- Use `###` for subsections
- Use `####` for minor sections

**Code Blocks**:
```typescript
// Use syntax highlighting
const example = 'code';
```

**Tables**:
| Column 1 | Column 2 |
|----------|----------|
| Data | Data |

**Lists**:
- Unordered lists for items without sequence
1. Ordered lists for sequential steps

---

## Creating New Templates

### When to Create a Template

**Create a template when**:
- Same document type created 3+ times
- Consistent structure needed
- Onboarding new team members
- Quality/completeness important

**Don't create template when**:
- One-off document
- Highly variable structure
- Simple/short documents

### Template Creation Process

1. **Identify pattern**: Notice repeated document structure
2. **Draft template**: Create with placeholders
3. **Test with real doc**: Use template to create actual document
4. **Refine**: Adjust based on usage
5. **Document**: Add to this README
6. **Announce**: Tell team template is available

### Template Best Practices

**Placeholders**:
- Use `[ALL_CAPS]` for required fields
- Use `[optional: lowercase]` for optional fields
- Provide examples in comments

**Instructions**:
- Add `<!-- TODO: ... -->` comments for guidance
- Explain non-obvious sections
- Link to examples

**Flexibility**:
- Allow sections to be added/removed
- Don't enforce rigid structure
- Adapt to document needs

---

## Slash Commands for Templates

### /new Command (Planned)

**Purpose**: Create new document from template

**Usage**:
```
/new feature breeding-mechanics
/new architecture payment-service
/new plan week-5-implementation
/new status day-5-review
```

**Behavior**:
1. Selects appropriate template based on type
2. Creates file in correct folder
3. Fills in placeholders (date, name, etc.)
4. Opens file for editing

---

## Maintenance

### Template Updates

**When to update**:
- Feedback from users
- New best practices
- Structural improvements
- New required sections

**Update process**:
1. Propose changes (document rationale)
2. Update template
3. Update this README
4. Notify team of changes
5. Update existing docs if needed

### Template Quality Metrics

**Good template has**:
- ✅ Clear purpose statement
- ✅ All necessary sections
- ✅ Helpful placeholders
- ✅ Examples where useful
- ✅ Flexible structure
- ✅ Used regularly (3+ times)

**Template needs work if**:
- ❌ Never or rarely used
- ❌ Always heavily modified
- ❌ Users create documents from scratch instead
- ❌ Missing key sections
- ❌ Too rigid or too vague

---

## Related Documentation

- **Guides**: [../guides/](../guides/) - How to use documentation
- **Rules**: [../rules/generalRules.md](../rules/generalRules.md) - Documentation standards
- **Quick Reference**: [../QUICK_REFERENCE.md](../QUICK_REFERENCE.md) - Finding templates

---

## Coming Soon

### Additional Templates (Future)

- **Sprint Planning**: Sprint kickoff document
- **Architecture Decision Record (ADR)**: Document major decisions
- **Test Plan**: Detailed testing approach
- **API Endpoint**: Document new API endpoints
- **Component**: React component documentation
- **Troubleshooting Guide**: Common issues and solutions

### Enhanced Features (Future)

- Auto-generate from slash commands
- Pre-filled metadata (date, author)
- Linting for template compliance
- Template versioning

---

**For complete .claude folder documentation, see [../README.md](../README.md)**
