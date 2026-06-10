# 11. Error Testing Patterns

### 11.1 Comprehensive Error Coverage

**Error Types to Test:**

- Database connection failures
- Invalid input validation
- Authentication failures
- Authorization denials
- Resource not found scenarios
- Timeout conditions

### 11.2 Error Testing Pattern

> **Updated 2026-06-10:** the former example mocked a Prisma failure with `jest.spyOn(prisma, ...)`. Mocking our own database is forbidden (§1.1, §12) — error paths are exercised through **real** error conditions: nonexistent IDs, invalid input, missing auth, real constraint violations. Failure modes that genuinely cannot be produced against the real DB (e.g. a hard connection outage) are middleware/fail-closed concerns covered by dedicated sentinel tests, not by mocking Prisma in feature suites.

```javascript
// ✅ Real error condition — invalid input, real DB, real validation path
test('should reject a horse with an invalid sex value', async () => {
  await expect(createHorse({ ...validHorseData, sex: 'NotASex' })).rejects.toThrow(/sex/i);
});

test('should return 404 for non-existent horse', async () => {
  const response = await request(app)
    .get('/api/horses/99999')
    .set('Authorization', `Bearer ${validToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
});
```

---
