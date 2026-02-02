# 2. Code Style Standards

### 2.1 JavaScript/Node.js (Backend)

#### ES Modules (Required)
```javascript
// ALWAYS use ES Modules (.mjs files)
import express from 'express';
import { createHorse } from './horseService.mjs';

// NEVER use CommonJS
// const express = require('express'); // Don't do this
```

#### Async/Await (Required)
```javascript
// GOOD - Use async/await
async function createHorseWithValidation(data) {
  await validateHorseData(data);
  const horse = await createHorse(data);
  await sendNotification(horse);
  return horse;
}

// BAD - Promise chains
function createHorseWithValidation(data) {
  return validateHorseData(data)
    .then(() => createHorse(data))
    .then(horse => sendNotification(horse).then(() => horse));
}
```

#### Error Handling (Required)
```javascript
// GOOD - Custom error classes
class HorseValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'HorseValidationError';
    this.field = field;
  }
}

// BAD - Generic errors
throw new Error('Invalid data'); // Not helpful
```

### 2.2 TypeScript/React (Frontend)

#### Strict Mode (Non-Negotiable)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### Component Patterns
```typescript
// GOOD - Typed functional component
interface HorseCardProps {
  horse: Horse;
  onSelect?: (horse: Horse) => void;
}

export function HorseCard({ horse, onSelect }: HorseCardProps) {
  const handleClick = () => {
    onSelect?.(horse);
  };

  return (
    <div onClick={handleClick}>
      <h3>{horse.name}</h3>
      <p>Age: {horse.age}</p>
    </div>
  );
}

// BAD - No types
export function HorseCard(props) {
  return <div>{props.horse.name}</div>;
}
```

#### State Management
```typescript
// React Query for server state
import { useQuery } from '@tanstack/react-query';

function HorseList() {
  const { data: horses, isLoading } = useQuery({
    queryKey: ['horses'],
    queryFn: fetchHorses,
  });

  if (isLoading) return <Loading />;
  return horses.map(horse => <HorseCard key={horse.id} horse={horse} />);
}

// useState for local component state
function HorseFilter() {
  const [searchTerm, setSearchTerm] = useState('');
  // ... filter logic
}
```

---
