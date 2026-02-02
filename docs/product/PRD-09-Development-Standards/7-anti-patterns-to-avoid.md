# 7. Anti-Patterns to Avoid

### 7.1 Magic Numbers
```typescript
// BAD
if (horse.age > 25) { /* ... */ }

// GOOD
const MAX_BREEDING_AGE = 25;
if (horse.age > MAX_BREEDING_AGE) { /* ... */ }
```

### 7.2 Callback Hell
```javascript
// BAD
function processHorse(id, callback) {
  getHorse(id, (horse) => {
    validateHorse(horse, (valid) => {
      if (valid) {
        saveHorse(horse, (result) => {
          callback(result);
        });
      }
    });
  });
}

// GOOD
async function processHorse(id) {
  const horse = await getHorse(id);
  const valid = await validateHorse(horse);
  if (valid) {
    return await saveHorse(horse);
  }
}
```

### 7.3 Using `any` Type
```typescript
// BAD
function processHorse(data: any) {
  return data.name;
}

// GOOD
interface Horse {
  id: string;
  name: string;
  age: number;
}

function processHorse(horse: Horse): string {
  return horse.name;
}
```

### 7.4 Premature Optimization
```typescript
// BAD - Over-optimizing before measuring
const memoizedEverything = useMemo(() => horse.name, [horse]);

// GOOD - Optimize when needed
const expensiveCalculation = useMemo(
  () => calculateGeneticProbabilities(horse),
  [horse]
);
```

---
