# Generate Indexes Command

**Purpose**: Auto-generate or update README.md index files for all folders in the .claude directory.

**Usage**: `/generateIndexes` or `/generate-indexes`

---

## Command Description

This command scans all folders in the `.claude` directory and automatically generates or updates README.md files that serve as indexes for each folder's contents. This ensures all documentation is properly indexed and easily discoverable.

---

## What This Command Does

1. **Scans folder structure**: Recursively scans `.claude/` and all subfolders
2. **Identifies files**: Lists all `.md` files in each folder
3. **Generates indexes**: Creates or updates README.md with:
   - Folder purpose and description
   - File listing with purposes
   - Quick navigation links
   - Statistics (file counts, lines, etc.)
4. **Maintains consistency**: Uses standardized format across all READMEs
5. **Preserves custom content**: Intelligently updates without losing manual additions

---

## Folders That Will Be Indexed

### Primary Folders

- `planning/` and subfolders (`current/`, `archive/`)
- `architecture/` and subfolders (`backend/`, `frontend/`, `database/`, `testing/`)
- `gameDesign/` and subfolders (`traits/`, `systems/`, `features/`)
- `status/`
- `guides/` and subfolders (`onboarding/`, `development/`, `tools/`)
- `reference/`
- `rules/`
- `templates/`
- `archive/`
- `commands/`

### Root Level

- Updates `.claude/README.md` with overall statistics
- Updates `.claude/QUICK_REFERENCE.md` if needed

---

## README.md Template Structure

Each generated README.md includes:

### 1. Header Section

```markdown
# [Folder Name]

**Purpose**: [Brief description]
**Last Updated**: [DATE]
```

### 2. Files Table

```markdown
| File                         | Purpose       | Lines | Status |
| ---------------------------- | ------------- | ----- | ------ |
| [filename.md](./filename.md) | [description] | ~X    | Active |
```

### 3. Quick Navigation

Links to frequently accessed files and related folders

### 4. Usage Guidelines

How to use files in this folder

### 5. Statistics

File counts, total lines, coverage information

### 6. Related Documentation

Links to related folders and key files

---

## Execution Steps

### Step 1: Scan Folder Structure

```bash
# Find all folders
find .claude/ -type d
```

### Step 2: For Each Folder

1. **List files**: Get all `.md` files in folder
2. **Extract metadata**:
   - File purposes (from first paragraph or header)
   - Line counts (`wc -l`)
   - Last modified dates
   - Status indicators
3. **Check for existing README.md**:
   - If exists: Parse and preserve custom sections
   - If not: Create from template
4. **Generate/update index**:
   - Update file listing table
   - Update statistics
   - Update "Last Updated" date
   - Preserve custom sections marked with `<!-- CUSTOM: ... -->`

### Step 3: Update Root README

Update `.claude/README.md` with:

- Updated folder counts
- Updated file counts
- Updated statistics
- New folders (if any)

### Step 4: Validation

- Verify all READMEs created/updated
- Check for broken links
- Validate markdown syntax
- Report summary

---

## Options (Future Enhancement)

```
/generateIndexes               # Generate all indexes
/generateIndexes planning/     # Generate for specific folder
/generateIndexes --dry-run     # Preview without writing
/generateIndexes --force       # Regenerate all, ignore custom sections
```

---

## Expected Output

```
Generating indexes for .claude folder...

📁 Scanning folders...
  Found 17 folders

📄 Processing files...
  planning/: 10 files → README.md updated
  planning/current/: 7 files → README.md created
  planning/archive/: 1 file → README.md created
  architecture/: 0 files → README.md updated (subfolder index)
  architecture/backend/: 7 files → README.md updated
  architecture/frontend/: 3 files → README.md updated
  architecture/database/: 2 files → README.md updated
  architecture/testing/: 3 files → README.md updated
  gameDesign/: 0 files → README.md updated (subfolder index)
  gameDesign/traits/: 11 files → README.md updated
  gameDesign/systems/: 7 files → README.md updated
  gameDesign/features/: 4 files → README.md updated
  status/: 8 files → README.md updated
  guides/: 0 files → README.md updated (subfolder index)
  guides/onboarding/: 5 files → README.md updated
  guides/development/: 10 files → README.md updated
  guides/tools/: 3 files → README.md updated
  reference/: 6 files → README.md updated
  rules/: 2 files → README.md updated
  templates/: 4 files → README.md updated
  commands/: 6 files → README.md updated

✅ Index generation complete!

Summary:
  - 17 README.md files updated/created
  - 78 files indexed
  - 0 errors
  - 0 warnings

Updated files:
  .claude/README.md (root index)
  [List of all updated READMEs]
```

---

## Error Handling

**Folder not found**: Skip and warn
**Permission denied**: Report error and skip
**Malformed markdown**: Warn but continue
**Circular references**: Detect and report

---

## Implementation Notes

### File Purpose Extraction

Extract purpose from:

1. First `**Purpose**:` line in file
2. First paragraph if no purpose line
3. First non-header line
4. Fallback: "[No description]"

### Line Count

```bash
wc -l filename.md | awk '{print $1}'
```

### Status Detection

- "Active": File modified within 30 days
- "Historical": File not modified in 90+ days
- "Draft": Contains "Status: Draft" or "TODO:" markers
- "Archived": In archive/ folder

### Custom Section Preservation

Preserve sections marked with:

```markdown
<!-- CUSTOM: Section Name -->

[Custom content here]

<!-- END CUSTOM -->
```

---

## Related Commands

- `/update-docs` - Update main CLAUDE.md documentation
- `/new` - Create new document from template
- `/search` - Search documentation

---

## Future Enhancements

1. **Auto-run on file changes**: Regenerate indexes when files added/removed
2. **Link validation**: Check for broken internal links
3. **Duplicate detection**: Warn about similar file names
4. **Auto-categorization**: Suggest folder for new files
5. **Statistics dashboard**: Generate visual stats (charts, graphs)

---

**For .claude folder documentation, see [../README.md](../README.md)**
