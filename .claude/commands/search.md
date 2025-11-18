# Search Documentation Command

**Purpose**: Search all documentation in the .claude folder with smart filtering and relevance ranking.

**Usage**: `/search <query>` or `/search <query> [options]`

---

## Command Description

This command provides powerful search capabilities across all documentation in the `.claude` folder, with smart filtering, relevance ranking, and context-aware results.

---

## Usage Examples

### Basic Search
```
/search groom system
/search token refresh
/search authentication flow
```

### Search with Type Filter
```
/search groom --type gamedesign
/search api --type architecture
/search day 3 --type status
```

### Search with Folder Filter
```
/search trait --folder gameDesign/traits
/search navigation --folder architecture/frontend
```

### Advanced Search
```
/search "epigenetic traits" --exact
/search groom -t gamedesign,architecture
/search test --exclude status
```

---

## What This Command Does

### Step 1: Parse Query
```
/search <query> [options]

Options:
  --type, -t <type>          Filter by document type
  --folder, -f <folder>      Search specific folder
  --exact, -e                Exact phrase match
  --case-sensitive, -c       Case-sensitive search
  --limit, -l <n>            Limit results (default: 20)
  --exclude, -x <folders>    Exclude folders
```

### Step 2: Search Files

**Search Locations**:
- All `.md` files in `.claude/` (except `node_modules/`)
- All subfolders recursively
- README.md files (weighted lower)

**Search Methods**:
1. **Full-text search**: Search file contents
2. **Filename search**: Match against filenames
3. **Heading search**: Match against markdown headings
4. **Metadata search**: Match against front matter

### Step 3: Rank Results

**Ranking Factors**:
- **Exact match**: +100 points
- **Filename match**: +50 points
- **Heading match**: +30 points
- **Content match**: +10 points
- **Recent file**: +5 points (per week)
- **Frequently accessed**: +10 points (from QUICK_REFERENCE)

**Relevance Score**: Sum of all factors

### Step 4: Display Results

**Format**:
```
Search results for "groom system" (23 matches)

1. gameDesign/systems/groomSystem.md (Relevance: 95)
   "Groom System - Complete mechanics and progression"
   ...groom system includes hiring, training, and progression...
   ...affecting trait development through the groom system...

2. architecture/backend/apiSpecs.md (Relevance: 45)
   "API Specifications"
   ...POST /grooms - Hire new groom for player...
   ...GET /grooms/:id - Get groom details and stats...

3. planning/current/frontendGroomImplementationPlan.md (Relevance: 40)
   "Frontend Groom Implementation Plan"
   ...implementing the groom system in the browser game...

[Show more results? (20 remaining)]
```

---

## Search Options

### Filter by Type (`--type`, `-t`)

**Supported Types**:
- `gamedesign`, `gd` - Game design documents
- `architecture`, `arch` - Architecture documents
- `planning`, `plan` - Planning documents
- `status` - Status reports
- `guides` - How-to guides
- `reference`, `ref` - Reference documents
- `rules` - Rules and standards

**Usage**:
```
/search groom --type gamedesign
/search api -t architecture,planning
```

### Filter by Folder (`--folder`, `-f`)

**Usage**:
```
/search trait --folder gameDesign/traits
/search test --folder architecture/testing
```

### Exact Match (`--exact`, `-e`)

Match exact phrase only:
```
/search "token refresh" --exact
```

### Case Sensitive (`--case-sensitive`, `-c`)

```
/search API --case-sensitive
```
Matches "API" but not "api" or "Api"

### Limit Results (`--limit`, `-l`)

```
/search groom --limit 5
```
Show only top 5 results

### Exclude Folders (`--exclude`, `-x`)

```
/search test --exclude archive,templates
```

---

## Search Patterns

### Simple Word Search
```
/search groom
```
Matches: "groom", "grooms", "grooming", "groomed"

### Multiple Words (AND)
```
/search groom progression
```
Matches files containing BOTH "groom" AND "progression"

### Phrase Search
```
/search "epigenetic trait system"
```
Matches exact phrase

### Wildcard Search
```
/search test*
```
Matches: "test", "testing", "tests", "testable"

### Boolean Search (Future)
```
/search groom AND (progression OR leveling)
/search trait NOT epigenetic
```

---

## Search Results Format

### Result Entry

```
[Rank]. [File Path] (Relevance: [Score])
   "[File Title/First Heading]"
   [Context snippets with search term highlighted]

   Lines: [line numbers where matches found]
   Last Modified: [date]
   [Additional metadata]
```

### Example Output

```
🔍 Search results for "authentication flow" (8 matches)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. architecture/frontend/frontendArchitecture.md (Relevance: 95)
   "Frontend Architecture - React Browser Game"

   ...Redux-driven navigation flow based on auth.isAuthenticated...
   ...Complete **authentication flow** from login to dashboard...

   Lines: 234, 567, 890
   Last Modified: 2025-01-13
   Category: Architecture (Frontend)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. status/day4TechnicalReview.md (Relevance: 85)
   "Day 4: Authentication Screens Implementation"

   ...implemented complete user **authentication flow**...
   ...tested **authentication flow** with 81 new tests...

   Lines: 45, 123, 456
   Last Modified: 2025-01-14
   Category: Status Report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. planning/current/week2Plan.md (Relevance: 60)
   "Week 2 Plan"

   ...backend integration for **authentication flow**...

   Lines: 89
   Last Modified: 2025-01-10
   Category: Planning

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Showing 3 of 8 results.

Options:
  [Enter] - Show next 3 results
  [n <num>] - Show result number <num>
  [r <query>] - Refine search
  [q] - Quit
```

---

## Advanced Features

### Fuzzy Search

Automatically handles typos and variations:
```
/search authentiction
→ Did you mean "authentication"?
  Showing results for "authentication"
```

### Related Terms

Suggests related search terms:
```
/search groom

Related searches:
  - groom progression
  - groom personality
  - groom retirement
  - training system
```

### Search History

```
/search --history

Recent searches:
  1. "authentication flow" (5 results)
  2. "groom system" (23 results)
  3. "trait modifiers" (12 results)

Repeat search: /search --history 1
```

### File Preview

```
/search groom --preview

1. groomSystem.md (Relevance: 95)
   [Show preview? y/n]

   > y

   # Groom System

   **Purpose**: Complete groom mechanics including hiring,
   progression, personality, and trait bonuses.

   ## Overview

   Grooms are NPCs that care for horses and influence their
   trait development...

   [Press any key to continue]
```

---

## Search Statistics

### After Each Search

```
📊 Search Statistics:

Query: "authentication"
Files Searched: 78
Matches Found: 8
Search Time: 0.15s

Top Folders:
  1. architecture/ (3 matches)
  2. status/ (2 matches)
  3. planning/ (2 matches)
  4. guides/ (1 match)

File Types:
  - Architecture docs: 3
  - Status reports: 2
  - Planning docs: 2
  - Guides: 1
```

---

## Integration with Other Commands

### Quick Open

```
/search groom
→ Results shown

Open result 1? [o 1]
→ Opens groomSystem.md
```

### Create Related Document

```
/search breeding
→ No results found

Create new document about breeding?
  /new feature breeding-mechanics
```

### Update Search Index

```
/generateIndexes
→ Updates search index for faster searches
```

---

## Error Handling

### No Results

```
🔍 No results found for "nonexistent term"

Suggestions:
  - Check spelling
  - Try broader search terms
  - Use wildcards: /search non*
  - Remove filters: --type, --folder

Browse folders:
  /search --browse
```

### Too Many Results

```
🔍 Found 156 results for "test"

Too many results to display. Try:
  - Add more specific terms: /search test authentication
  - Filter by type: /search test --type architecture
  - Filter by folder: /search test --folder architecture/testing
  - Limit results: /search test --limit 10
```

### Search Error

```
❌ Error: Invalid search pattern

Pattern: /search [test
Error: Unclosed bracket

Valid examples:
  /search test
  /search "exact phrase"
  /search test* (wildcard)
```

---

## Performance Optimization

### Search Index

**Automatic indexing**:
- Generated on first search
- Updated when files change
- Cached for fast subsequent searches

**Index Contents**:
- File paths
- File contents (tokenized)
- Headings
- Metadata
- Modification dates

**Index Location**: `.claude/.search-index/`

### Caching

**Cache Strategy**:
- Recent searches cached (last 20)
- Results cached for 5 minutes
- Index cached until files change

---

## Command Aliases

```
/search <query>      # Full command
/s <query>           # Short alias
/find <query>        # Alternative name
```

---

## Related Commands

- `/generateIndexes` - Update search index
- `/new` - Create new document
- `/update-docs` - Update main documentation

---

## Future Enhancements

1. **Semantic search**: Understand query intent
   ```
   /search how to add new feature
   → Shows guides, architecture docs, and templates
   ```

2. **Code search**: Search actual code files
   ```
   /search --code LoginScreen
   ```

3. **Visual search**: Search diagrams and images (OCR)

4. **Export results**: Save search results
   ```
   /search groom --export results.md
   ```

5. **Search analytics**: Track what's searched most
   ```
   /search --analytics
   → Shows most searched terms, trends
   ```

6. **AI-powered suggestions**: "Users who searched X also searched Y"

---

## Technical Implementation

### Search Algorithm

```typescript
interface SearchResult {
  file: string;
  relevance: number;
  matches: Match[];
  context: string[];
}

interface Match {
  line: number;
  column: number;
  text: string;
  type: 'exact' | 'fuzzy' | 'partial';
}

async function search(query: string, options: SearchOptions): Promise<SearchResult[]> {
  // 1. Parse query and options
  const parsed = parseQuery(query, options);

  // 2. Load or generate search index
  const index = await loadSearchIndex();

  // 3. Search index
  const results = index.search(parsed);

  // 4. Rank results
  const ranked = rankResults(results);

  // 5. Format and return
  return formatResults(ranked, options);
}
```

---

**For .claude folder documentation, see [../README.md](../README.md)**
