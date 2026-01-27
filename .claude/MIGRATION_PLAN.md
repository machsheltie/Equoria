# Documentation Migration Plan

**Goal:** Reduce context load from 2,117+ lines to ~200 lines
**Method:** Convert bloated docs to on-demand skills
**Benefit:** No more immediate compaction, faster responses

---

## 📊 Current State

### Context Load (Before)

- Main `CLAUDE.md`: 1,053 lines ⚠️
- `.claude/rules/` (7 files): 1,064 lines ⚠️
- **Total: 2,117 lines every session** 🔴

### Issues

- Immediate context compaction before work starts
- Slow response times
- Duplicate/outdated information
- Rarely-needed docs always loaded

---

## ✅ Migration Steps

### Step 1: Replace Main CLAUDE.md (DONE)

Created `CLAUDE.LEAN.md` (150 lines) with:

- Current sprint status
- Essential rules only
- Links to skills for details

**Action Required:**

```bash
# Backup old CLAUDE.md
mv CLAUDE.md CLAUDE.OLD.md

# Use new lean version
mv CLAUDE.LEAN.md CLAUDE.md
```

### Step 2: Skills Created (DONE)

Created 7 on-demand skills in `.claude/commands/`:

- ✅ `/security-guide` - Security documentation
- ✅ `/es-modules-guide` - ES Modules troubleshooting
- ✅ `/contributing` - Contribution guidelines
- ✅ `/backend-api` - Backend API docs
- ✅ `/test-architecture` - Testing strategy
- ✅ `/groom-system` - Groom implementation
- ✅ `/deployment-guide` - Deployment procedures

### Step 3: Update .claudeignore (DONE)

Updated `.claudeignore` to:

- ✅ Keep `.claude/commands/` (skills) accessible
- ✅ Exclude `.claude/rules/` (detailed docs)
- ✅ Exclude `.claude/docs/` (archive/systems docs)

### Step 4: Clean Up Global CLAUDE.md Files

**Multiple conflicting CLAUDE.md files detected:**

- `C:\Users\heirr\.claude\CLAUDE.md` (Sunday Brunch project - WRONG)
- `C:\Users\heirr\CLAUDE.md` (Equoria mobile - WRONG)
- `C:\Users\heirr\OneDrive\Desktop\Equoria\CLAUDE.md` (This project - CORRECT)

**Action Required:**

```bash
# Remove or move conflicting files
# These contain wrong project information
# Option 1: Delete (if not needed)
rm "C:\Users\heirr\.claude\CLAUDE.md"
rm "C:\Users\heirr\CLAUDE.md"

# Option 2: Archive (if needed for other projects)
mkdir -p ~/archived-configs
mv "C:\Users\heirr\.claude\CLAUDE.md" ~/archived-configs/sunday-brunch-CLAUDE.md
mv "C:\Users\heirr\CLAUDE.md" ~/archived-configs/equoria-mobile-CLAUDE.md
```

### Step 5: Clean Up Duplicate Files

**Multiple duplicate locations:**

- `backend/.claude/rules/` (duplicates of main rules)
- `codehelpers/augment/rules/` (legacy location)
- `docs/history/claude-*` (historical archives)

**Action Required:**

```bash
# Archive backend/.claude/rules/ duplicates
# (Keep backend/.claude/docs/ for backend-specific docs)

# Remove legacy codehelpers directory
rm -rf codehelpers/

# History is already archived, ensure it stays out of context
# (Already in .claudeignore via docs/ pattern)
```

---

## 📈 Expected Results

### Context Load (After)

- Main `CLAUDE.md`: ~150 lines ✅
- Skills loaded on-demand only ✅
- **Total auto-load: ~150 lines** 🟢

### Benefits

- ✅ No immediate compaction
- ✅ Faster response times
- ✅ 93% context reduction (2,117 → 150 lines)
- ✅ More tokens for actual work
- ✅ Skills loaded only when relevant

---

## 🔧 How to Use After Migration

### Starting Work

```bash
# No compaction needed! Start immediately
# Main CLAUDE.md is lean and focused
```

### When You Need Details

```bash
# Load specific documentation via skills
/security-guide      # When working on auth
/test-architecture   # When writing tests
/backend-api        # When creating endpoints
```

### Manual Access (If Needed)

```bash
# Full docs still available, just not auto-loaded
cat .claude/rules/SECURITY.md
cat .claude/docs/api/backend-overview.md
```

---

## 🎯 Quick Win Checklist

- [ ] Backup old CLAUDE.md (`mv CLAUDE.md CLAUDE.OLD.md`)
- [ ] Activate lean version (`mv CLAUDE.LEAN.md CLAUDE.md`)
- [ ] Remove conflicting global CLAUDE.md files
- [ ] Test: Open new Claude Code session (should start fast)
- [ ] Verify: No compaction before first message
- [ ] Test skill: Try `/security-guide` to load on-demand
- [ ] Clean up: Remove duplicate backend/.claude/rules/
- [ ] Clean up: Remove legacy codehelpers/

---

## 📝 Notes

### What Changed

- **Before:** All documentation loaded automatically
- **After:** Only current sprint + essential rules loaded
- **Details:** Available via `/skill-name` commands

### What Stays the Same

- All documentation content preserved
- Same information, just organized differently
- Skills provide same info on-demand

### Rollback (If Needed)

```bash
# Restore old version
mv CLAUDE.OLD.md CLAUDE.md
```

---

**Migration Status:** Ready to Execute
**Estimated Time:** 5 minutes
**Risk Level:** Low (all docs preserved, easy rollback)
