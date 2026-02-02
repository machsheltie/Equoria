# 3. Database Best Practices

### 3.1 Prisma Schema Design

```prisma
// GOOD - Clear relationships, proper types
model Horse {
  id        String   @id @default(uuid())
  name      String
  age       Int
  genetics  Json     // JSONB for flexible game data
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
  @@index([createdAt])
}
```

### 3.2 Query Optimization

```typescript
// GOOD - Include relations, select only needed fields
const horses = await prisma.horse.findMany({
  where: { ownerId: userId },
  select: {
    id: true,
    name: true,
    age: true,
    owner: {
      select: { id: true, username: true },
    },
  },
  take: 20,
  orderBy: { createdAt: 'desc' },
});

// BAD - N+1 query problem
const horses = await prisma.horse.findMany();
for (const horse of horses) {
  const owner = await prisma.user.findUnique({
    where: { id: horse.ownerId }
  }); // N+1 queries!
}
```

### 3.3 JSONB Best Practices

```typescript
// GOOD - Structured JSONB with TypeScript
interface HorseGenetics {
  coat: {
    base: string;
    dilution?: string;
    modifiers: string[];
  };
  height: number;
  temperament: string[];
}

await prisma.horse.create({
  data: {
    name: 'Thunderbolt',
    genetics: {
      coat: { base: 'bay', modifiers: ['flaxen'] },
      height: 16.2,
      temperament: ['spirited', 'brave']
    } as HorseGenetics,
  },
});
```

---
