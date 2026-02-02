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

```javascript
test('should handle database connection failure', async () => {
  // Mock database failure
  jest.spyOn(prisma, 'horse').mockRejectedValue(
    new Error('Connection failed')
  );

  // Verify proper error handling
  await expect(getHorseById(1)).rejects.toThrow('Connection failed');
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
