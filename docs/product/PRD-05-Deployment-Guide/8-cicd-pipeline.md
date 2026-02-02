# 8. CI/CD Pipeline

### 8.1 GitHub Actions Workflow

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: equoria_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Your deployment script here
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

### 8.2 Quality Gates

**Pre-Deployment:**
- [ ] PR approved and merged
- [ ] All tests passing (468+ tests)
- [ ] Lint checks passing
- [ ] Staging environment tested
- [ ] Rollback plan confirmed
- [ ] Monitoring alerts configured

**During Deployment:**
- [ ] Blue-green deployment executed
- [ ] Health checks pass
- [ ] New endpoints responding
- [ ] Performance metrics normal

**Post-Deployment:**
- [ ] Monitor for 24 hours
- [ ] Check error logs
- [ ] Verify frontend integration
- [ ] Update external documentation

---
