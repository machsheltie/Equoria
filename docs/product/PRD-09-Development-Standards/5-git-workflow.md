# 5. Git Workflow

### 5.1 Commit Messages

**Format:** Conventional Commits
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance |

**Examples:**
```
feat(breeding): Add genetic trait inheritance system

Implemented multi-allele genetic system with dominant/recessive
traits for coat color, height, and temperament.

Closes #123
```

### 5.2 Branch Naming

```
type/description

Examples:
- feat/authentication-system
- fix/horse-age-validation
- refactor/database-queries
- test/competition-scoring
```

### 5.3 Pull Request Guidelines

**Title:** Same as commit message format

**Description Template:**
```markdown
## Summary
Brief description of changes

## Changes Made
- Bullet point list of key changes

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests passing
- [ ] Manual testing completed

## Screenshots
(If UI changes)
```

---
