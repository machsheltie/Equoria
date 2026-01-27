# New Document Command

**Purpose**: Create new documentation from templates with automatic file placement and metadata population.

**Usage**: `/new <type> <name>` or `/new <type> <name> [options]`

---

## Command Description

This command creates new documentation files from predefined templates, automatically placing them in the correct folder, populating metadata (date, author, etc.), and opening the file for editing.

---

## Usage Examples

### Create Game Design Feature

```
/new feature breeding-mechanics
/new feature social-system
/new gamedesign exotic-traits
```

**Creates**: `.claude/gameDesign/features/breedingMechanics.md`

### Create Architecture Document

```
/new architecture payment-service
/new arch api-gateway
/new backend notification-service
```

**Creates**: `.claude/architecture/backend/paymentService.md`

### Create Implementation Plan

```
/new plan week-5-implementation
/new implementation authentication-flow
```

**Creates**: `.claude/planning/current/week5Implementation.md`

### Create Status Report

```
/new status day-5-review
/new report phase-2-summary
```

**Creates**: `.claude/status/day5Review.md`

---

## Supported Document Types

### Game Design (`feature` | `gamedesign` | `gd`)

**Template**: `templates/gameDesignFeature.md`
**Location**: `gameDesign/features/`
**Subfolder Options**:

- `/new feature:trait <name>` → `gameDesign/traits/`
- `/new feature:system <name>` → `gameDesign/systems/`
- `/new feature:feature <name>` → `gameDesign/features/` (default)

### Architecture (`architecture` | `arch` | `a`)

**Template**: `templates/architectureDoc.md`
**Location**: `architecture/backend/` (default)
**Subfolder Options**:

- `/new arch:backend <name>` → `architecture/backend/`
- `/new arch:frontend <name>` → `architecture/frontend/`
- `/new arch:database <name>` → `architecture/database/`
- `/new arch:testing <name>` → `architecture/testing/`

### Implementation Plan (`plan` | `implementation` | `impl`)

**Template**: `templates/implementationPlan.md`
**Location**: `planning/current/`

### Status Report (`status` | `report` | `review`)

**Template**: `templates/statusReport.md`
**Location**: `status/`

---

## What This Command Does

### Step 1: Parse Command

```
/new <type> <name> [options]

Examples:
  /new feature breeding-mechanics
  /new arch:frontend user-profile
  /new plan week-5-sprint-1
  /new status day-6-review
```

### Step 2: Determine Template and Location

**Type Mapping**:
| Input Type | Template | Default Location |
|------------|----------|------------------|
| `feature`, `gamedesign`, `gd` | gameDesignFeature.md | gameDesign/features/ |
| `architecture`, `arch`, `a` | architectureDoc.md | architecture/backend/ |
| `plan`, `implementation`, `impl` | implementationPlan.md | planning/current/ |
| `status`, `report`, `review` | statusReport.md | status/ |

**Subfolder Handling**:

- `type:subfolder` → Specific subfolder
- `type` alone → Default subfolder

### Step 3: Generate Filename

**Conversion Rules**:

```
Input: "breeding-mechanics"     → breedingMechanics.md
Input: "week-5-sprint-1"        → week5Sprint1.md
Input: "api_gateway_design"     → apiGatewayDesign.md
Input: "UserProfileComponent"   → userProfileComponent.md
```

**Algorithm**:

1. Convert to camelCase
2. Remove special characters
3. Add `.md` extension

### Step 4: Copy Template

```bash
cp .claude/templates/<template>.md .claude/<location>/<filename>.md
```

### Step 5: Populate Metadata

**Replace Placeholders**:

- `[DATE]` → Current date (YYYY-MM-DD)
- `[YOUR_NAME]` → User name (from git config)
- `[FEATURE_NAME]` → Document name (from input)
- `[SYSTEM_NAME]` → Document name (from input)
- `[DAY_NAME]` → Day/phase name (from input)

**Smart Replacements**:

```markdown
# [FEATURE_NAME] - Game Design Document

↓

# Breeding Mechanics - Game Design Document

**Created**: [DATE]
↓
**Created**: 2025-01-14

**Author**: [YOUR_NAME]
↓
**Author**: Claude Assistant
```

### Step 6: Open File for Editing

Open the newly created file in the default editor for user to complete.

---

## Command Options

### Basic Usage

```
/new <type> <name>
```

### With Subfolder

```
/new <type>:<subfolder> <name>
```

### With Custom Location

```
/new <type> <name> --path custom/path/
```

### Dry Run (Preview)

```
/new <type> <name> --dry-run
```

Shows what would be created without actually creating it.

### Force Overwrite

```
/new <type> <name> --force
```

Overwrites existing file if it exists (prompts by default).

---

## Expected Output

### Success

```
Creating new document...

Type: feature
Template: gameDesignFeature.md
Name: breedingMechanics.md
Location: .claude/gameDesign/features/

✅ File created: .claude/gameDesign/features/breedingMechanics.md

Populated metadata:
  - Date: 2025-01-14
  - Author: Claude Assistant
  - Feature Name: Breeding Mechanics

Opening file for editing...

Next steps:
  1. Fill in the template sections
  2. Add file to git when ready
  3. Update gameDesign/features/README.md to include this file
```

### Dry Run

```
[DRY RUN] Would create:

Type: architecture:backend
Template: architectureDoc.md
Name: paymentService.md
Location: .claude/architecture/backend/

File: .claude/architecture/backend/paymentService.md
Size: ~10,000 lines (from template)

No changes made (dry run mode).
```

### Error: File Exists

```
❌ Error: File already exists

File: .claude/gameDesign/features/breedingMechanics.md

Options:
  1. Use a different name: /new feature breeding-mechanics-v2
  2. Force overwrite: /new feature breeding-mechanics --force
  3. Edit existing file: Open .claude/gameDesign/features/breedingMechanics.md
```

---

## Error Handling

### Invalid Type

```
❌ Error: Invalid document type 'foo'

Valid types:
  - feature, gamedesign, gd (game design)
  - architecture, arch, a (architecture)
  - plan, implementation, impl (implementation plan)
  - status, report, review (status report)

Usage: /new <type> <name>
Example: /new feature breeding-mechanics
```

### Invalid Name

```
❌ Error: Invalid name format

Name cannot contain: / \ : * ? " < > |

Valid examples:
  - breeding-mechanics
  - week-5-implementation
  - api-gateway-design

Current input: "breeding/mechanics"
```

### Template Not Found

```
❌ Error: Template not found

Template: gameDesignFeature.md
Expected location: .claude/templates/gameDesignFeature.md

Please ensure templates exist:
  - /generateIndexes (to check folder structure)
  - Or create template manually
```

---

## Implementation Details

### Filename Conversion

```typescript
function toFilename(input: string): string {
  // Convert to camelCase
  const camelCase = input
    .split(/[-_\s]+/)
    .map((word, i) =>
      i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join('');

  // Remove special characters
  const clean = camelCase.replace(/[^a-zA-Z0-9]/g, '');

  return `${clean}.md`;
}

// Examples:
// "breeding-mechanics" → "breedingMechanics.md"
// "week_5_sprint_1" → "week5Sprint1.md"
// "API Gateway Design" → "apiGatewayDesign.md"
```

### Metadata Population

```typescript
function populateMetadata(content: string, metadata: Metadata): string {
  return content
    .replace(/\[DATE\]/g, metadata.date)
    .replace(/\[YOUR_NAME\]/g, metadata.author)
    .replace(/\[FEATURE_NAME\]/g, metadata.name)
    .replace(/\[SYSTEM_NAME\]/g, metadata.name)
    .replace(/\[DAY_NAME\]/g, metadata.name)
    .replace(/\[PHASE_NAME\]/g, metadata.name);
}
```

### Author Detection

```bash
# Try to get from git config
git config user.name

# Fallback to environment
echo $USER

# Default
echo "Claude Assistant"
```

---

## Integration with Other Commands

### After Creating Document

1. **Auto-open editor**: Open file for immediate editing
2. **Suggest indexing**: Prompt to run `/generateIndexes` to update folder README
3. **Git tracking**: File is untracked, user can stage when ready

### With /generateIndexes

```
/new feature breeding-mechanics
  → Creates file

/generateIndexes gameDesign/features/
  → Updates gameDesign/features/README.md to include new file
```

---

## Related Commands

- `/generateIndexes` - Update folder indexes after creating files
- `/update-docs` - Update main CLAUDE.md documentation
- `/search` - Search for similar existing documents

---

## Future Enhancements

1. **Interactive mode**: Prompt for fields if not provided

   ```
   /new
   → Select type: [feature | architecture | plan | status]
   → Enter name: _____
   → Select subfolder: [traits | systems | features]
   ```

2. **Quick templates**: Shorter templates for common docs

   ```
   /new quick-note my-idea
   → Creates simple markdown file
   ```

3. **From existing**: Create from existing file as template

   ```
   /new feature new-feature --like existing-feature
   ```

4. **Auto-populate**: Pre-fill common sections from context

   ```
   /new feature breeding --auto-populate
   → Fills in related systems, dependencies based on codebase analysis
   ```

5. **Validation**: Check for similar files before creating
   ```
   ⚠️  Similar file found: breedingSystem.md
   Continue anyway? [y/n]
   ```

---

**For .claude folder documentation, see [../README.md](../README.md)**
