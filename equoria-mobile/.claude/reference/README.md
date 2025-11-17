# Reference Folder

**Purpose**: Product requirements, specifications, and high-level project documentation for the Equoria platform.

**Last Updated**: 2025-01-14

---

## Files in This Folder

| File | Purpose | Lines | Audience |
|------|---------|-------|----------|
| [productRequirementsDocument.md](./productRequirementsDocument.md) | Complete product spec | ~1,200 | All stakeholders |
| [equoriaSpecifics.md](./equoriaSpecifics.md) | Equoria-specific details | ~800 | Development team |
| [projectSummary.md](./projectSummary.md) | High-level overview | ~400 | Management/new team |
| [projectMilestones.md](./projectMilestones.md) | Timeline and milestones | ~500 | Planning/tracking |
| [rulesProjectMilestones.md](./rulesProjectMilestones.md) | Rules-specific milestones | ~300 | Rules team |
| [license.md](./license.md) | Project license | ~50 | Legal/contributors |

**Total**: 6 files, ~3,250 lines

---

## Quick Navigation

### Essential Reading
- **New to project?** → [projectSummary.md](./projectSummary.md)
- **Need full requirements?** → [productRequirementsDocument.md](./productRequirementsDocument.md)
- **Game-specific details?** → [equoriaSpecifics.md](./equoriaSpecifics.md)

### Planning & Tracking
- **Timeline?** → [projectMilestones.md](./projectMilestones.md)
- **License info?** → [license.md](./license.md)

---

## Document Summaries

### Product Requirements Document (PRD)

**File**: [productRequirementsDocument.md](./productRequirementsDocument.md)

**Purpose**: Comprehensive product specification

**Key Sections**:
- Executive summary
- Product vision and goals
- User personas and user stories
- Feature requirements
- Technical requirements
- Success metrics
- Timeline and milestones
- Risk assessment

**When to read**:
- Starting new feature development
- Need to understand product vision
- Clarifying requirements
- Making architectural decisions

### Equoria Specifics

**File**: [equoriaSpecifics.md](./equoriaSpecifics.md)

**Purpose**: Game-specific mechanics and details

**Key Sections**:
- Horse breeding genetics
- Trait system overview
- Groom mechanics
- Training and competitions
- Economy design
- Monetization strategy

**When to read**:
- Implementing game mechanics
- Understanding core gameplay
- Balancing game features
- Designing new features

### Project Summary

**File**: [projectSummary.md](./projectSummary.md)

**Purpose**: High-level project overview

**Key Sections**:
- Project description
- Target audience
- Core features
- Technology stack
- Team structure
- Current status

**When to read**:
- First day on project
- Explaining project to others
- Quick reference for context
- Status updates to stakeholders

### Project Milestones

**File**: [projectMilestones.md](./projectMilestones.md)

**Purpose**: Timeline and delivery schedule

**Key Sections**:
- Week-by-week breakdown
- Feature delivery dates
- Testing milestones
- Deployment schedule
- Risk mitigation

**When to read**:
- Planning sprints
- Tracking progress
- Identifying blockers
- Updating stakeholders

### License

**File**: [license.md](./license.md)

**Purpose**: Project license terms

**Key Information**:
- License type (MIT, Apache, proprietary, etc.)
- Usage rights
- Contribution terms
- Copyright notice

**When to read**:
- Before contributing
- Understanding usage rights
- Legal questions

---

## Product Vision

### Mission Statement

**Create an immersive horse breeding simulation that combines realistic genetics with engaging gameplay, rewarding strategic thinking and long-term planning.**

### Core Values

1. **Depth**: Rich mechanics that reward mastery
2. **Accessibility**: Easy to learn, difficult to master
3. **Realism**: Grounded in real horse breeding principles
4. **Fantasy**: Magic and exotic elements for engagement
5. **Community**: Social features and competitions

### Target Audience

**Primary**: Horse enthusiasts aged 25-45
**Secondary**: Strategy game players aged 18-35
**Tertiary**: Casual mobile gamers looking for depth

---

## Feature Roadmap

### Phase 1: MVP (Weeks 1-4) - CURRENT

**Status**: 80% complete (Day 4/5 done)

**Core Features**:
- ✅ User authentication
- ✅ Basic horse breeding
- [ ] Groom system (basic)
- [ ] Training mechanics
- [ ] Local competitions

### Phase 2: Enhanced Gameplay (Weeks 5-8)

**Status**: Planning

**Features**:
- Advanced trait system
- Groom progression
- Regional/national competitions
- Foal enrichment
- Social features (friends, messaging)

### Phase 3: Premium Features (Weeks 9-12)

**Status**: Design

**Features**:
- Exotic traits
- Special events
- Player vs player competitions
- Customization options
- Premium currency features

### Phase 4: Polish & Scale (Weeks 13-16)

**Status**: Concept

**Features**:
- Performance optimization
- Server scaling
- Additional content (breeds, disciplines)
- Tutorial improvements
- Analytics integration

---

## Success Metrics

### Key Performance Indicators (KPIs)

**User Engagement**:
- Daily Active Users (DAU): Target 10,000+
- Monthly Active Users (MAU): Target 50,000+
- Average session length: Target 15+ minutes
- Retention (Day 7): Target 40%+
- Retention (Day 30): Target 20%+

**Monetization**:
- Average Revenue Per User (ARPU): Target $2+
- Conversion rate (free to paid): Target 5%+
- Lifetime Value (LTV): Target $15+

**Quality**:
- App Store rating: Target 4.5+ stars
- Crash rate: <0.1%
- Bug reports per 1000 users: <5
- Customer satisfaction: 85%+

---

## Technical Requirements

### Platform Requirements

**Mobile**:
- iOS 15+ (iPhone 8 and newer)
- Android 11+ (mid-range devices and up)

**Backend**:
- Node.js 18+
- PostgreSQL 15+
- Prisma ORM 5.x

**Frontend**:
- React Native 0.81.5
- TypeScript 5.x
- Redux Toolkit
- React Query

### Performance Requirements

**Mobile App**:
- Initial load: <2s
- Screen transitions: <200ms
- API response (local): <500ms
- Memory usage: <150MB
- Battery drain: <5% per hour

**Backend**:
- API response time: <200ms (p95)
- Database query time: <50ms (p95)
- Concurrent users: 10,000+
- Uptime: 99.9%

### Security Requirements

**Authentication**:
- JWT with refresh tokens
- bcrypt password hashing
- 2FA support (optional)

**Data Protection**:
- HTTPS encryption
- Secure token storage
- Input validation
- SQL injection prevention
- XSS protection

---

## How to Use This Folder

### Finding Reference Documentation

**By Purpose**:
- Understanding product? → [productRequirementsDocument.md](./productRequirementsDocument.md)
- Quick overview? → [projectSummary.md](./projectSummary.md)
- Game mechanics? → [equoriaSpecifics.md](./equoriaSpecifics.md)
- Timeline? → [projectMilestones.md](./projectMilestones.md)

**By Audience**:
- New team member: Start with [projectSummary.md](./projectSummary.md)
- Product manager: Focus on [productRequirementsDocument.md](./productRequirementsDocument.md)
- Developer: Read [equoriaSpecifics.md](./equoriaSpecifics.md)
- Legal: Check [license.md](./license.md)

### Updating Reference Documents

**When to update**:
- Product vision changes
- New features added
- Requirements clarified
- Milestones adjusted
- Metrics updated

**Update process**:
1. Identify document needing update
2. Make changes with clear rationale
3. Update "Last Updated" date
4. Add changelog entry
5. Notify team of significant changes

---

## Document Relationships

### PRD → Architecture
**Flow**: Product requirements → Technical architecture design
**Link**: [../architecture/](../architecture/)

### PRD → Game Design
**Flow**: Product features → Detailed game mechanics
**Link**: [../gameDesign/](../gameDesign/)

### Milestones → Planning
**Flow**: High-level milestones → Detailed sprint plans
**Link**: [../planning/](../planning/)

### PRD → Status
**Flow**: Requirements → Implementation tracking
**Link**: [../status/](../status/)

---

## Common Questions

### Q: What is Equoria?
**A**: Horse breeding simulation game combining realistic genetics with engaging gameplay. See [projectSummary.md](./projectSummary.md).

### Q: Who is the target audience?
**A**: Primary: Horse enthusiasts 25-45. Secondary: Strategy gamers 18-35. See PRD for details.

### Q: What's the current status?
**A**: Day 4 of Week 1 complete (80% of Phase 1). See [../status/systemsStatusOverview.md](../status/systemsStatusOverview.md).

### Q: When is the launch date?
**A**: Target: End of Week 16. See [projectMilestones.md](./projectMilestones.md) for full timeline.

### Q: What's the monetization model?
**A**: Freemium with optional premium currency. See [equoriaSpecifics.md](./equoriaSpecifics.md) economy section.

---

## Related Documentation

- **Architecture**: [../architecture/](../architecture/) - Technical implementation
- **Game Design**: [../gameDesign/](../gameDesign/) - Detailed mechanics
- **Planning**: [../planning/](../planning/) - Sprint plans
- **Guides**: [../guides/onboarding/](../guides/onboarding/) - Getting started

---

## Statistics

**Total Documents**: 6 files
- PRD: 1,200 lines
- Specifications: 800 lines
- Summary: 400 lines
- Milestones: 800 lines (combined)
- License: 50 lines

**Total Lines**: ~3,250 lines of reference documentation

**Coverage**: Complete product and project specifications

---

**For complete .claude folder documentation, see [../README.md](../README.md)**
