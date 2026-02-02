# 8. Backend Load Testing

### 8.1 Artillery Configuration

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
scenarios:
  - flow:
      - post:
          url: '/api/auth/login'
          json:
            email: 'test@example.com'
            password: 'password123'
          capture:
            - json: '$.data.accessToken'
              as: 'token'
      - get:
          url: '/api/horses'
          headers:
            Authorization: 'Bearer {{ token }}'
      - post:
          url: '/api/training/train'
          headers:
            Authorization: 'Bearer {{ token }}'
          json:
            horseId: 1
            discipline: 'dressage'
```

### 8.2 Performance Targets

| Metric | Target |
|--------|--------|
| Response time (p95) | <200ms |
| Response time (p99) | <500ms |
| Throughput | 100+ req/s |
| Error rate | <0.1% |
| Concurrent users | 500+ |

---
