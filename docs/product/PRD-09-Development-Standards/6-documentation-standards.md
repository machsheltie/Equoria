# 6. Documentation Standards

### 6.1 Code Documentation

**JSDoc for Functions:**
```typescript
/**
 * Creates a new horse with genetic trait inheritance
 * @param sireId - ID of the sire (father) horse
 * @param damId - ID of the dam (mother) horse
 * @param name - Name for the new foal
 * @returns Promise resolving to the created horse
 * @throws {ValidationError} If parent horses are incompatible
 */
async function breedHorses(
  sireId: string,
  damId: string,
  name: string
): Promise<Horse> {
  // Implementation
}
```

**Inline Comments:**
```typescript
function calculateGeneticTrait(sireGene: Gene, damGene: Gene): Gene {
  // Dominant genes take precedence in heterozygous pairs
  if (sireGene.dominance > damGene.dominance) {
    return sireGene;
  }

  // Equal dominance results in random selection (Mendelian inheritance)
  return Math.random() < 0.5 ? sireGene : damGene;
}
```

### 6.2 Document Standards

- **Maximum 500 lines** per document
- **Clear title and version**
- **Last updated date**
- **Status indicators**
- **Cross-references**

---
