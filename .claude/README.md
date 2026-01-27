# .claude/ Directory

**Purpose:** Project configuration and documentation for Claude Code AI assistant
**Organization:** Streamlined for minimal context consumption

---

## 📁 Directory Structure

```
.claude/
├── README.md                          # This file
├── DOCUMENTATION_STREAMLINE_SUMMARY.md # Streamlining overview
├── MIGRATION_PLAN.md                  # Step-by-step migration guide
│
├── commands/                          # On-demand skills (✅ auto-loaded)
│   ├── README.md                      # Skills index
│   ├── security-guide.md              # /security-guide skill
│   ├── es-modules-guide.md            # /es-modules-guide skill
│   ├── test-architecture.md           # /test-architecture skill
│   ├── backend-api.md                 # /backend-api skill
│   ├── contributing.md                # /contributing skill
│   ├── groom-system.md                # /groom-system skill
│   └── deployment-guide.md            # /deployment-guide skill
│
├── rules/                             # Detailed docs (❌ excluded via .claudeignore)
│   ├── SECURITY.md                    # Full security documentation
│   ├── ES_MODULES_REQUIREMENTS.md     # ES Modules detailed guide
│   ├── CONTRIBUTING.md                # Contribution standards
│   ├── GENERAL_RULES.md               # General development rules
│   ├── README.md                      # Backend overview
│   ├── console_logging.md             # Console logging standards
│   └── LICENSE.md                     # Project license
│
├── docs/                              # System docs (❌ excluded via .claudeignore)
│   ├── api/                           # API layer documentation
│   │   ├── backend-overview.md
│   │   ├── controllers-layer.md
│   │   ├── models-layer.md
│   │   ├── routes-layer.md
│   │   ├── utils-layer.md
│   │   └── GROOM_API_TEST_PLAN.md
│   │
│   ├── systems/                       # Game system documentation
│   │   └── FOAL_ENRICHMENT_SUMMARY.md
│   │
│   ├── archive/                       # Historical documentation
│   │   ├── SECURITY_IMPLEMENTATION_TASKS.md
│   │   ├── FINAL_STATUS_REPORT.md
│   │   └── IMPLEMENTATION_SUMMARY.md
│   │
│   └── planning/                      # Planning documents
│       └── DEPLOYMENT.md
│
└── activation-instructions/           # Hook activation guides
```

---

## 🎯 Context Loading Strategy

### ✅ Always Loaded (Minimal)

- Root `CLAUDE.md` (~150 lines) - Current sprint + essential rules
- `.claude/commands/` - Lightweight skill wrappers

### 📞 On-Demand (Via Skills)

- `/security-guide` → Loads `.claude/rules/SECURITY.md`
- `/es-modules-guide` → Loads `.claude/rules/ES_MODULES_REQUIREMENTS.md`
- `/test-architecture` → Loads testing documentation
- `/backend-api` → Loads API layer docs
- And 3 more skills...

### ❌ Never Auto-Loaded

- `.claude/rules/` - Detailed reference docs
- `.claude/docs/` - System and API documentation
- Controlled via `.claudeignore`

---

## 🚀 How to Use

### Starting a Session

```bash
# Open Claude Code - starts instantly!
# Lean CLAUDE.md provides current sprint + essential rules
# No compaction needed
```

### Loading Specific Documentation

```bash
# Type slash commands to load on-demand
/security-guide      # Security docs
/test-architecture   # Testing strategy
/backend-api        # API layer docs
```

### Manual Access

```bash
# All docs still accessible manually
cat .claude/rules/SECURITY.md
cat .claude/docs/api/backend-overview.md
```

---

## 📊 Context Optimization

### Before Streamlining

- Auto-loaded: 2,117+ lines
- Result: Immediate compaction
- Problem: Context exhaustion before work starts

### After Streamlining

- Auto-loaded: ~150 lines
- Result: Instant startup
- Benefit: 93% context reduction

---

## 🔧 Maintenance

### Adding New Skills

1. Create `.claude/commands/new-skill.md`
2. Include: purpose, when to use, quick reference
3. Link to full documentation in `.claude/rules/` or `.claude/docs/`
4. Update `.claude/commands/README.md` index
5. Use `/new-skill` to invoke

### Adding New Documentation

1. Full docs go in `.claude/rules/` or `.claude/docs/`
2. Create skill wrapper in `.claude/commands/` if frequently needed
3. Reference from main `CLAUDE.md` if critical

### Updating Main Config

1. Keep `CLAUDE.md` under 200 lines
2. Only include current sprint status
3. Only include absolutely essential rules
4. Link to skills for details

---

## 📝 Key Files

### Configuration

- `../CLAUDE.md` - Lean project config (root level)
- `.claudeignore` - Context exclusion rules (root level)

### Documentation Index

- `commands/README.md` - Skills catalog
- `DOCUMENTATION_STREAMLINE_SUMMARY.md` - Optimization overview
- `MIGRATION_PLAN.md` - Activation guide

### Skills (On-Demand)

- All skills in `commands/` directory
- Invoked with `/skill-name` commands
- Lightweight wrappers linking to full docs

---

## 🎯 Philosophy

**Goal:** Minimal auto-load context, maximum on-demand access
**Method:** Skills system with .claudeignore exclusions
**Result:** Fast startup, full documentation when needed

---

**Last Updated:** 2026-01-27
**Status:** Streamlined and optimized
**Context Load:** 93% reduction (2,117 → 150 lines)
