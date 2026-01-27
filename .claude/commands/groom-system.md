# Groom System Documentation

**Skill:** `/groom-system`
**Purpose:** Load groom system implementation details and API specs

---

## When to Use This Skill

Invoke this skill when:

- Working on groom-related endpoints
- Understanding groom mechanics
- Debugging groom interactions
- Adding groom features
- Testing groom API

---

## Groom System Overview

The groom system manages professional caretakers for foals with:

- Age-based foal care (birth to 3 years)
- Skill/personality combinations
- Assignment priorities
- Interaction tracking
- Daily care limits

---

## Quick API Reference

### Endpoints

- `POST /api/grooms/hire` - Hire new groom
- `POST /api/grooms/assign` - Assign groom to foal
- `POST /api/grooms/interact` - Record interaction
- `GET /api/grooms/user/:userid` - Get user's grooms
- `GET /api/grooms/definitions` - System configurations

### Test Coverage

- 22 API tests (100% pass rate)
- Complete business logic validation
- Comprehensive edge case coverage

---

**Load full documentation:**

```bash
# API test plan
cat .claude/docs/api/GROOM_API_TEST_PLAN.md

# System implementation
cat backend/.claude/docs/systems/groom-system.md
```
