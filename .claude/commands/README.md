# Claude Code Skills

This directory contains **on-demand documentation skills** that can be invoked with `/` commands instead of being loaded into context automatically.

---

## Available Skills

### Security & Standards

- `/security-guide` - Full security documentation (auth, validation, exploits)
- `/es-modules-guide` - ES Modules troubleshooting and requirements
- `/contributing` - Contribution guidelines and coding standards

### Backend Architecture & API

- `/backend-api` - Backend API documentation (controllers, routes, models)
- `/database-guide` - Database schema, queries, Prisma ORM, migrations

### Game Systems

- `/groom-system` - Groom system implementation and API
- `/breeding-system` - Breeding mechanics and genetics documentation
- `/training-system` - Training mechanics and progression
- `/trait-system` - Trait discovery and epigenetic systems

### Frontend Development

- `/frontend-guide` - Frontend development patterns (React 19, TypeScript, Tailwind)

### Testing & Quality

- `/test-architecture` - Testing strategy and balanced mocking guide

### Operations

- `/deployment-guide` - Production deployment procedures

---

## How to Use Skills

### Method 1: Direct Skill Invocation (Recommended)

```bash
# In Claude Code chat
/security-guide
/es-modules-guide
/backend-api
```

### Method 2: Manual File Read

```bash
# When you need the full document
cat .claude/commands/security-guide.md
cat .claude/rules/SECURITY.md
```

---

## Why Skills Instead of Auto-Load?

**Problem:** Loading all documentation automatically causes:

- Context exhaustion (2,117+ lines loaded every session)
- Immediate compaction before work starts
- Slow response times
- Wasted tokens on rarely-needed docs

**Solution:** On-demand loading via skills:

- Only load what you need, when you need it
- Keeps main CLAUDE.md lean (~150 lines)
- Fast startup and response times
- Token budget available for actual work

---

## Creating New Skills

1. Create `.claude/commands/skill-name.md`
2. Include:
   - Skill purpose and when to use
   - Quick reference information
   - Links to full documentation
3. Add to this README index
4. Use `/skill-name` to invoke

---

## Skills vs. Rules

**Rules (.claude/rules/):**

- Detailed reference documentation
- Should NOT be auto-loaded
- Called by skills when needed

**Skills (.claude/commands/):**

- Lightweight wrappers (<100 lines)
- Tell you WHEN to use full docs
- Invoked with `/` commands

**Main CLAUDE.md:**

- Current sprint status
- Essential rules only (~150 lines)
- Links to skills for details

---

**Last Updated:** 2026-01-27
